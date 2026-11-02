<div class="footer">
  <a class="btn" href="{{ $b['vcfUrl'] }}"><x-icon name="download" :size="16" /> <span>Save contact</span></a>
  <a class="btn" href="{{ $b['pdfUrl'] }}"><x-icon name="printer" :size="16" /> <span>PDF</span></a>
  <button type="button" class="btn" data-share><x-icon name="share-2" :size="16" /> <span>Share</span></button>
</div>
<p class="powered">Digital card by <a href="{{ rtrim((string) config('app.url'), '/') ?: '/' }}" target="_blank" rel="noopener">Markkito</a></p>
