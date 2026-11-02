<?php

// The business categories (CategorySeeder). The slug is made from the name
// unless given; a category already in the database with the same slug is
// updated (name and description), so existing listings keep their category.
// Add a category here and re-run:
//   php artisan db:seed --class=CategorySeeder
// Re-seeding never deletes a category.

return [
    // Food
    ['name' => 'Restaurants', 'description' => 'Dining and food outlets'],
    ['name' => 'Cafes & Bakeries', 'description' => 'Coffee shops, tea stalls, bakeries and cake shops'],
    ['name' => 'Sweets & Snacks', 'description' => 'Sweet shops, namkeen and snack stores'],
    ['name' => 'Caterers', 'description' => 'Catering for weddings, parties and offices'],
    ['name' => 'Grocery & Supermarkets', 'description' => 'Grocery stores, supermarkets and provision shops'],
    ['name' => 'Fruits & Vegetables', 'description' => 'Fresh fruit and vegetable sellers'],
    ['name' => 'Meat & Fish', 'description' => 'Chicken, mutton, fish and seafood shops'],

    // Travel & stay
    ['name' => 'Hotels & Lodges', 'description' => 'Hotels, lodges, resorts and homestays'],
    ['name' => 'Travel Agents', 'description' => 'Tour packages, ticket booking and visa services'],
    ['name' => 'Taxi & Cab Services', 'description' => 'Taxis, cabs and airport transfers'],
    ['name' => 'Car Rentals', 'description' => 'Self-drive cars and cars with driver on hire'],

    // Health
    ['name' => 'Hospitals', 'description' => 'Multi-speciality and general hospitals'],
    ['name' => 'Clinics & Doctors', 'description' => 'General physicians and specialist clinics'],
    ['name' => 'Dentists', 'description' => 'Dental clinics and orthodontists'],
    ['name' => 'Diagnostic Labs', 'description' => 'Blood tests, scans and diagnostic centres'],
    ['name' => 'Pharmacies', 'description' => 'Medical shops and chemists'],
    ['name' => 'Ayurveda & Homeopathy', 'description' => 'Ayurvedic, homeopathic and Siddha treatment'],
    ['name' => 'Physiotherapy', 'description' => 'Physiotherapy and rehabilitation centres'],
    ['name' => 'Opticians', 'description' => 'Spectacles, contact lenses and eye tests'],

    // Beauty & fitness
    ['name' => 'Beauty Parlours', 'description' => 'Beauty parlours, bridal makeup and skin treatments'],
    ['name' => 'Salons & Barbers', 'description' => 'Hair salons, unisex salons and barber shops'],
    ['name' => 'Spa & Massage', 'description' => 'Spas, massage and wellness centres'],
    ['name' => 'Gyms & Fitness', 'description' => 'Gyms, fitness studios and personal trainers'],
    ['name' => 'Yoga Classes', 'description' => 'Yoga and meditation classes'],

    // Education
    ['name' => 'Schools', 'description' => 'Pre-schools, play schools and schools'],
    ['name' => 'Colleges', 'description' => 'Colleges, universities and institutes'],
    ['name' => 'Tuition & Coaching', 'description' => 'Tuition centres and entrance exam coaching'],
    ['name' => 'Computer Training', 'description' => 'Computer courses, programming and software training'],
    ['name' => 'Driving Schools', 'description' => 'Car and two-wheeler driving lessons'],
    ['name' => 'Music & Dance Classes', 'description' => 'Music, dance and art classes'],

    // Home services
    ['name' => 'Home Services', 'slug' => 'home-services', 'description' => 'Plumbers, electricians, cleaners'],
    ['name' => 'Plumbers', 'description' => 'Plumbing installation and repair'],
    ['name' => 'Electricians', 'description' => 'Electrical wiring, installation and repair'],
    ['name' => 'Carpenters', 'description' => 'Furniture making, woodwork and repair'],
    ['name' => 'Painters', 'description' => 'House painting and waterproofing'],
    ['name' => 'AC & Appliance Repair', 'description' => 'AC, fridge, washing machine and TV repair'],
    ['name' => 'Pest Control', 'description' => 'Termite, cockroach and pest control services'],
    ['name' => 'Cleaning Services', 'description' => 'Home, office, sofa and water tank cleaning'],
    ['name' => 'Laundry & Dry Cleaning', 'description' => 'Laundry, ironing and dry cleaning'],
    ['name' => 'Packers & Movers', 'description' => 'House shifting, packing and moving'],
    ['name' => 'Interior Designers', 'description' => 'Interior design, modular kitchens and wardrobes'],
    ['name' => 'Furniture Stores', 'description' => 'Furniture showrooms and mattresses'],

    // Construction
    ['name' => 'Building Contractors', 'description' => 'House construction and renovation'],
    ['name' => 'Architects', 'description' => 'Architects and building planners'],
    ['name' => 'Building Materials', 'description' => 'Cement, steel, bricks, tiles and sand'],
    ['name' => 'Hardware & Sanitary', 'description' => 'Hardware, paints, pipes and sanitary ware'],

    // Vehicles
    ['name' => 'Car Service & Repair', 'description' => 'Car service centres, mechanics and car wash'],
    ['name' => 'Bike Service & Repair', 'description' => 'Two-wheeler service and repair'],
    ['name' => 'Car Dealers', 'description' => 'New and used car showrooms'],
    ['name' => 'Bike Dealers', 'description' => 'New and used two-wheeler showrooms'],
    ['name' => 'Tyres & Batteries', 'description' => 'Tyre shops, wheel alignment and batteries'],

    // Shopping
    ['name' => 'Clothing & Fashion', 'description' => 'Clothing stores, textiles and fashion'],
    ['name' => 'Tailors & Boutiques', 'description' => 'Tailoring, stitching and designer boutiques'],
    ['name' => 'Footwear', 'description' => 'Footwear shops and shoe stores'],
    ['name' => 'Jewellery', 'description' => 'Gold, silver and diamond jewellery'],
    ['name' => 'Mobile Phones & Accessories', 'description' => 'Mobile phone shops and accessories'],
    ['name' => 'Computers & Laptops', 'description' => 'Computer and laptop sales and accessories'],
    ['name' => 'Electronics & Appliances', 'description' => 'TVs, home appliances and electronics'],
    ['name' => 'Mobile & Laptop Repair', 'description' => 'Mobile phone, laptop and computer repair'],
    ['name' => 'Books & Stationery', 'description' => 'Bookshops and stationery stores'],
    ['name' => 'Gift Shops', 'description' => 'Gifts, novelties and greeting cards'],
    ['name' => 'Florists', 'description' => 'Flower shops and bouquets'],
    ['name' => 'Toys & Baby Products', 'description' => 'Toys, baby care and kids products'],
    ['name' => 'Pet Shops & Vets', 'description' => 'Pet shops, pet food and veterinary clinics'],

    // Events
    ['name' => 'Wedding Planners', 'description' => 'Wedding planning and bridal services'],
    ['name' => 'Banquet Halls', 'description' => 'Banquet halls, auditoriums and party venues'],
    ['name' => 'Event Management', 'description' => 'Event organisers, decorators and sound and light'],
    ['name' => 'Photographers', 'description' => 'Photographers, videographers and studios'],

    // Professional services
    ['name' => 'Lawyers & Advocates', 'description' => 'Lawyers, advocates and legal services'],
    ['name' => 'Chartered Accountants', 'description' => 'CAs, tax consultants and GST filing'],
    ['name' => 'Real Estate Agents', 'description' => 'Buying, selling and renting property'],
    ['name' => 'Insurance Agents', 'description' => 'Life, health and vehicle insurance'],
    ['name' => 'Banks & Finance', 'description' => 'Banks, loans and financial services'],
    ['name' => 'Printing & Flex', 'description' => 'Printing presses, flex boards and visiting cards'],
    ['name' => 'Courier Services', 'description' => 'Courier and parcel delivery'],
    ['name' => 'Digital Marketing & Web Design', 'description' => 'Websites, digital marketing and social media'],

    // Business to business
    ['name' => 'Manufacturing & Supplies', 'slug' => 'manufacturing-supplies', 'description' => 'B2B raw materials and equipment'],
    ['name' => 'Wholesale Traders', 'description' => 'Wholesalers and distributors'],
];
