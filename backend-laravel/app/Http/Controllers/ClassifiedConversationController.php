<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\ClassifiedConversation;
use App\Models\ClassifiedListing;
use App\Models\ClassifiedMessage;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassifiedConversationController extends Controller
{
    private function assertParticipant(array $actor, ClassifiedConversation $conversation): void
    {
        if ($actor['sub'] !== $conversation->buyerId && $actor['sub'] !== $conversation->sellerId) {
            throw ApiException::forbidden('You are not part of this conversation');
        }
    }

    // Every caller (store/index/messages) needs the conversation in the same
    // {id, listing, otherParty, role, lastMessage, lastMessageAt, unread}
    // shape — whichever side the actor is on, "otherParty" is whoever they're
    // talking to, so the frontend never has to know about buyer/seller at all.
    private function present(ClassifiedConversation $conversation, array $actor, ?ClassifiedMessage $lastMessage = null): array
    {
        $isBuyer = $conversation->buyerId === $actor['sub'];
        $lastReadAt = $isBuyer ? $conversation->buyerLastReadAt : $conversation->sellerLastReadAt;
        $lastMessage ??= $conversation->relationLoaded('messages') ? $conversation->messages->last() : null;

        return [
            'id' => $conversation->id,
            'listing' => $conversation->listing,
            'otherParty' => $isBuyer ? $conversation->seller : $conversation->buyer,
            'role' => $isBuyer ? 'buyer' : 'seller',
            'lastMessage' => $lastMessage?->body,
            'lastMessageAt' => $conversation->lastMessageAt,
            'unread' => $lastMessage && $lastMessage->senderId !== $actor['sub']
                && (! $lastReadAt || $lastReadAt->lt($lastMessage->createdAt)),
        ];
    }

    // A buyer's very first message to a seller about a listing — finds the
    // existing thread for this (listing, buyer) pair or opens a new one.
    // A reply within an already-open thread goes through reply() instead,
    // since by then either side may be sending it.
    public function store(Request $request, string $listingId)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate(['body' => ['required', 'string', 'min:1', 'max:2000']]);

        $listing = ClassifiedListing::find($listingId);
        if (! $listing) {
            throw ApiException::notFound('Listing not found');
        }
        if ($listing->sellerId === $actor['sub']) {
            throw ApiException::badRequest('You cannot message yourself about your own listing');
        }

        [$conversation, $message] = DB::transaction(function () use ($listing, $actor, $data) {
            $conversation = ClassifiedConversation::firstOrCreate(
                ['listingId' => $listing->id, 'buyerId' => $actor['sub']],
                ['sellerId' => $listing->sellerId]
            );

            $message = ClassifiedMessage::create([
                'conversationId' => $conversation->id,
                'senderId' => $actor['sub'],
                'body' => $data['body'],
            ]);

            $conversation->update([
                'lastMessageAt' => $message->createdAt,
                'buyerLastReadAt' => $message->createdAt,
            ]);

            return [$conversation, $message];
        });

        $conversation->load(['listing:id,title,slug,sellerId,status', 'listing.photos' => fn ($p) => $p->limit(1), 'buyer:id,firstName,lastName', 'seller:id,firstName,lastName']);

        return ApiResponse::created($this->present($conversation, $actor, $message));
    }

    // Every conversation the signed-in user is part of, as either buyer or
    // seller, newest activity first.
    public function index(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $query = ClassifiedConversation::where('buyerId', $actor['sub'])->orWhere('sellerId', $actor['sub']);
        $total = (clone $query)->count();
        $conversations = $query->orderByDesc('lastMessageAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with([
                'listing:id,title,slug,sellerId,status',
                'listing.photos' => fn ($p) => $p->limit(1),
                'buyer:id,firstName,lastName',
                'seller:id,firstName,lastName',
                'messages' => fn ($q) => $q->orderByDesc('createdAt')->limit(1),
            ])
            ->get()
            ->map(fn ($c) => $this->present($c, $actor));

        return ApiResponse::paginated($conversations, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function unreadCount(Request $request)
    {
        $actor = $request->attributes->get('auth');

        $count = ClassifiedConversation::where(function ($q) use ($actor) {
            $q->where('buyerId', $actor['sub'])->orWhere('sellerId', $actor['sub']);
        })
            ->whereNotNull('lastMessageAt')
            ->get(['id', 'buyerId', 'sellerId', 'lastMessageAt', 'buyerLastReadAt', 'sellerLastReadAt'])
            ->filter(function ($c) use ($actor) {
                $isBuyer = $c->buyerId === $actor['sub'];
                $lastReadAt = $isBuyer ? $c->buyerLastReadAt : $c->sellerLastReadAt;

                return ! $lastReadAt || $lastReadAt->lt($c->lastMessageAt);
            })
            ->count();

        return ApiResponse::ok(['count' => $count]);
    }

    public function messages(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $conversation = ClassifiedConversation::with(['listing:id,title,slug,sellerId,status', 'listing.photos' => fn ($p) => $p->limit(1), 'buyer:id,firstName,lastName', 'seller:id,firstName,lastName'])->find($id);
        if (! $conversation) {
            throw ApiException::notFound('Conversation not found');
        }
        $this->assertParticipant($actor, $conversation);

        $pagination = Pagination::parse($request->query());
        $query = ClassifiedMessage::where('conversationId', $id);
        $total = (clone $query)->count();
        $messages = $query->orderBy('createdAt')->skip($pagination['skip'])->take($pagination['take'])->get();

        return response()->json([
            'success' => true,
            'data' => $messages,
            'conversation' => $this->present($conversation, $actor, $messages->last()),
            'meta' => ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total],
        ]);
    }

    public function reply(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate(['body' => ['required', 'string', 'min:1', 'max:2000']]);

        $conversation = ClassifiedConversation::find($id);
        if (! $conversation) {
            throw ApiException::notFound('Conversation not found');
        }
        $this->assertParticipant($actor, $conversation);

        $isBuyer = $conversation->buyerId === $actor['sub'];

        $message = DB::transaction(function () use ($conversation, $actor, $data, $isBuyer) {
            $message = ClassifiedMessage::create([
                'conversationId' => $conversation->id,
                'senderId' => $actor['sub'],
                'body' => $data['body'],
            ]);

            $conversation->update([
                'lastMessageAt' => $message->createdAt,
                $isBuyer ? 'buyerLastReadAt' : 'sellerLastReadAt' => $message->createdAt,
            ]);

            return $message;
        });

        return ApiResponse::created($message);
    }

    public function markRead(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $conversation = ClassifiedConversation::find($id);
        if (! $conversation) {
            throw ApiException::notFound('Conversation not found');
        }
        $this->assertParticipant($actor, $conversation);

        $isBuyer = $conversation->buyerId === $actor['sub'];
        $conversation->update([$isBuyer ? 'buyerLastReadAt' : 'sellerLastReadAt' => now()]);

        return ApiResponse::ok($conversation);
    }
}
