-- Seed sample categories for the business management system
-- This migration adds common product categories and subcategories

-- Insert main categories
INSERT INTO categories (id, name, description, code, sort_order, is_active) VALUES
(UUID(), 'Electronics', 'Electronic devices and accessories', 'ELEC', 1, 1),
(UUID(), 'Clothing', 'Apparel and fashion items', 'CLTH', 2, 1),
(UUID(), 'Home & Garden', 'Home improvement and garden supplies', 'HOME', 3, 1),
(UUID(), 'Sports & Outdoors', 'Sports equipment and outdoor gear', 'SPRT', 4, 1),
(UUID(), 'Books & Media', 'Books, movies, and media content', 'BOOK', 5, 1),
(UUID(), 'Food & Beverages', 'Food items and beverages', 'FOOD', 6, 1),
(UUID(), 'Health & Beauty', 'Health and beauty products', 'HLTH', 7, 1),
(UUID(), 'Automotive', 'Automotive parts and accessories', 'AUTO', 8, 1),
(UUID(), 'Office Supplies', 'Office and stationery items', 'OFFICE', 9, 1),
(UUID(), 'Toys & Games', 'Toys, games, and entertainment', 'TOYS', 10, 1);

-- Get category IDs and insert subcategories
SET @elec_id = (SELECT id FROM categories WHERE code = 'ELEC');
SET @clth_id = (SELECT id FROM categories WHERE code = 'CLTH');
SET @home_id = (SELECT id FROM categories WHERE code = 'HOME');
SET @sprt_id = (SELECT id FROM categories WHERE code = 'SPRT');
SET @book_id = (SELECT id FROM categories WHERE code = 'BOOK');
SET @food_id = (SELECT id FROM categories WHERE code = 'FOOD');
SET @hlth_id = (SELECT id FROM categories WHERE code = 'HLTH');
SET @auto_id = (SELECT id FROM categories WHERE code = 'AUTO');
SET @office_id = (SELECT id FROM categories WHERE code = 'OFFICE');
SET @toys_id = (SELECT id FROM categories WHERE code = 'TOYS');

-- Electronics subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Smartphones', 'Mobile phones and smartphones', 'ELEC-SMART', @elec_id, 1, 1),
(UUID(), 'Laptops', 'Portable computers and laptops', 'ELEC-LAPTOP', @elec_id, 2, 1),
(UUID(), 'Tablets', 'Tablet computers and iPads', 'ELEC-TABLET', @elec_id, 3, 1),
(UUID(), 'Accessories', 'Electronic accessories and peripherals', 'ELEC-ACC', @elec_id, 4, 1),
(UUID(), 'Audio Equipment', 'Speakers, headphones, and audio devices', 'ELEC-AUDIO', @elec_id, 5, 1);

-- Clothing subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Men\'s Clothing', 'Clothing for men', 'CLTH-MEN', @clth_id, 1, 1),
(UUID(), 'Women\'s Clothing', 'Clothing for women', 'CLTH-WOMEN', @clth_id, 2, 1),
(UUID(), 'Kids\' Clothing', 'Clothing for children', 'CLTH-KIDS', @clth_id, 3, 1),
(UUID(), 'Shoes', 'Footwear for all ages', 'CLTH-SHOES', @clth_id, 4, 1),
(UUID(), 'Accessories', 'Fashion accessories and jewelry', 'CLTH-ACC', @clth_id, 5, 1);

-- Home & Garden subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Furniture', 'Home and office furniture', 'HOME-FURN', @home_id, 1, 1),
(UUID(), 'Kitchen & Dining', 'Kitchen appliances and dining items', 'HOME-KITCH', @home_id, 2, 1),
(UUID(), 'Garden Tools', 'Gardening tools and equipment', 'HOME-GARDEN', @home_id, 3, 1),
(UUID(), 'Lighting', 'Home lighting and lamps', 'HOME-LIGHT', @home_id, 4, 1),
(UUID(), 'Decor', 'Home decoration and accessories', 'HOME-DECOR', @home_id, 5, 1);

-- Sports & Outdoors subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Fitness Equipment', 'Exercise and fitness equipment', 'SPRT-FITNESS', @sprt_id, 1, 1),
(UUID(), 'Team Sports', 'Team sports equipment and gear', 'SPRT-TEAM', @sprt_id, 2, 1),
(UUID(), 'Outdoor Recreation', 'Outdoor recreation equipment', 'SPRT-OUTDOOR', @sprt_id, 3, 1),
(UUID(), 'Camping Gear', 'Camping and hiking equipment', 'SPRT-CAMP', @sprt_id, 4, 1),
(UUID(), 'Water Sports', 'Water sports and swimming equipment', 'SPRT-WATER', @sprt_id, 5, 1);

-- Books & Media subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Books', 'Physical and digital books', 'BOOK-BOOKS', @book_id, 1, 1),
(UUID(), 'Movies', 'DVDs, Blu-rays, and digital movies', 'BOOK-MOVIES', @book_id, 2, 1),
(UUID(), 'Music', 'CDs, vinyl, and digital music', 'BOOK-MUSIC', @book_id, 3, 1),
(UUID(), 'Magazines', 'Periodicals and magazines', 'BOOK-MAGS', @book_id, 4, 1),
(UUID(), 'Educational', 'Educational materials and courses', 'BOOK-EDU', @book_id, 5, 1);

-- Food & Beverages subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Fresh Produce', 'Fresh fruits and vegetables', 'FOOD-FRESH', @food_id, 1, 1),
(UUID(), 'Dairy & Eggs', 'Dairy products and eggs', 'FOOD-DAIRY', @food_id, 2, 1),
(UUID(), 'Beverages', 'Drinks and beverages', 'FOOD-BEVERAGE', @food_id, 3, 1),
(UUID(), 'Snacks', 'Snack foods and treats', 'FOOD-SNACKS', @food_id, 4, 1),
(UUID(), 'Pantry Items', 'Canned and packaged foods', 'FOOD-PANTRY', @food_id, 5, 1);

-- Health & Beauty subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Personal Care', 'Personal hygiene and care products', 'HLTH-CARE', @hlth_id, 1, 1),
(UUID(), 'Cosmetics', 'Makeup and beauty products', 'HLTH-COSMETIC', @hlth_id, 2, 1),
(UUID(), 'Vitamins & Supplements', 'Health supplements and vitamins', 'HLTH-VITAMIN', @hlth_id, 3, 1),
(UUID(), 'Medical Supplies', 'Medical and first aid supplies', 'HLTH-MEDICAL', @hlth_id, 4, 1),
(UUID(), 'Fragrances', 'Perfumes and fragrances', 'HLTH-FRAGRANCE', @hlth_id, 5, 1);

-- Automotive subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Car Parts', 'Automotive parts and components', 'AUTO-PARTS', @auto_id, 1, 1),
(UUID(), 'Accessories', 'Car accessories and add-ons', 'AUTO-ACC', @auto_id, 2, 1),
(UUID(), 'Tools', 'Automotive tools and equipment', 'AUTO-TOOLS', @auto_id, 3, 1),
(UUID(), 'Maintenance', 'Car maintenance and care products', 'AUTO-MAINT', @auto_id, 4, 1),
(UUID(), 'Motorcycle', 'Motorcycle parts and accessories', 'AUTO-MOTO', @auto_id, 5, 1);

-- Office Supplies subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Stationery', 'Pens, paper, and basic office supplies', 'OFFICE-STAT', @office_id, 1, 1),
(UUID(), 'Technology', 'Computers, printers, and office tech', 'OFFICE-TECH', @office_id, 2, 1),
(UUID(), 'Furniture', 'Office furniture and seating', 'OFFICE-FURN', @office_id, 3, 1),
(UUID(), 'Storage', 'Filing and storage solutions', 'OFFICE-STORAGE', @office_id, 4, 1),
(UUID(), 'Presentation', 'Presentation and display materials', 'OFFICE-PRESENT', @office_id, 5, 1);

-- Toys & Games subcategories
INSERT INTO categories (id, name, description, code, parent_id, sort_order, is_active) VALUES
(UUID(), 'Board Games', 'Board games and tabletop games', 'TOYS-BOARD', @toys_id, 1, 1),
(UUID(), 'Action Figures', 'Action figures and collectibles', 'TOYS-ACTION', @toys_id, 2, 1),
(UUID(), 'Educational', 'Educational toys and learning materials', 'TOYS-EDU', @toys_id, 3, 1),
(UUID(), 'Outdoor Toys', 'Outdoor toys and playground equipment', 'TOYS-OUTDOOR', @toys_id, 4, 1),
(UUID(), 'Arts & Crafts', 'Arts and crafts supplies', 'TOYS-ARTS', @toys_id, 5, 1);
