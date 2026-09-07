"""Generates a dummy sales CSV for testing BigQuery Explorer's file tab.

Long/P&L shape: each transaction produces two rows sharing the same
date/location/category/channel/product_name, distinguished by `account`
("Volume" = units sold, "Sales" = $ revenue) with a single `amount` column.
Sales per unit = Sum(amount where account=Sales) / Sum(amount where account=Volume).

Usage: python scripts/generate_dummy_sales.py [total_rows] [output_path]
"""

import csv
import random
import sys
from datetime import date, timedelta
from pathlib import Path

TOTAL_ROWS = int(sys.argv[1]) if len(sys.argv) > 1 else 30_000
NUM_TRANSACTIONS = max(1, TOTAL_ROWS // 2)
OUTPUT_PATH = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "sample_data" / "dummy_sales.csv"

random.seed(42)

START_DATE = date(2024, 1, 1)
END_DATE = date(2026, 9, 7)
DATE_SPAN_DAYS = (END_DATE - START_DATE).days

LOCATIONS = [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
    "San Francisco", "Seattle", "Boston", "Miami", "Denver",
    "Atlanta", "Austin",
]

CHANNELS = ["Online", "In-Store", "Marketplace", "Wholesale"]
CHANNEL_WEIGHTS = [0.45, 0.30, 0.15, 0.10]

# category -> (products, unit price range)
CATEGORIES = {
    "Electronics": (
        ["Wireless Earbuds", "Bluetooth Speaker", "Smartphone Case", "USB-C Charger",
         "4K Monitor", "Laptop Stand", "Mechanical Keyboard", "Wireless Mouse",
         "Portable SSD", "Smart Watch"],
        (15, 350),
    ),
    "Apparel": (
        ["Cotton T-Shirt", "Denim Jeans", "Running Shoes", "Wool Sweater",
         "Rain Jacket", "Yoga Pants", "Baseball Cap", "Leather Belt",
         "Graphic Hoodie", "Ankle Socks"],
        (8, 95),
    ),
    "Home & Garden": (
        ["Ceramic Planter", "LED Desk Lamp", "Throw Pillow", "Garden Hose",
         "Cutting Board", "Wall Clock", "Storage Bin", "Area Rug",
         "Candle Set", "Patio Chair"],
        (10, 180),
    ),
    "Sports & Outdoors": (
        ["Yoga Mat", "Camping Tent", "Water Bottle", "Hiking Backpack",
         "Resistance Bands", "Bike Helmet", "Fishing Rod", "Sleeping Bag",
         "Dumbbell Set", "Soccer Ball"],
        (10, 220),
    ),
    "Beauty": (
        ["Facial Cleanser", "Moisturizer", "Lip Balm", "Shampoo",
         "Hair Dryer", "Nail Polish", "Sunscreen SPF50", "Makeup Brush Set",
         "Perfume", "Face Mask"],
        (4, 60),
    ),
    "Toys": (
        ["Building Blocks", "Puzzle 500pc", "Remote Control Car", "Board Game",
         "Stuffed Bear", "Action Figure", "Art Set", "Toy Drone",
         "Play Kitchen", "Card Game"],
        (6, 90),
    ),
    "Grocery": (
        ["Organic Coffee", "Olive Oil", "Pasta", "Granola Bars",
         "Sparkling Water", "Almond Butter", "Green Tea", "Trail Mix",
         "Honey", "Dark Chocolate"],
        (2, 25),
    ),
    "Books": (
        ["Mystery Novel", "Cookbook", "Children's Picture Book", "Self-Help Guide",
         "Sci-Fi Novel", "Biography", "Travel Guide", "Poetry Collection",
         "History Book", "Graphic Novel"],
        (7, 40),
    ),
}
CATEGORY_NAMES = list(CATEGORIES.keys())


def random_date() -> date:
    return START_DATE + timedelta(days=random.randint(0, DATE_SPAN_DAYS))


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    rows_written = 0
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "location", "category", "channel", "product_name", "account", "amount"])

        for _ in range(NUM_TRANSACTIONS):
            category = random.choice(CATEGORY_NAMES)
            products, (lo, hi) = CATEGORIES[category]
            product = random.choice(products)
            location = random.choice(LOCATIONS)
            channel = random.choices(CHANNELS, weights=CHANNEL_WEIGHTS, k=1)[0]
            quantity = random.randint(1, 20)
            unit_price = round(random.uniform(lo, hi), 2)
            revenue = round(quantity * unit_price, 2)
            txn_date = random_date().isoformat()

            writer.writerow([txn_date, location, category, channel, product, "Volume", quantity])
            writer.writerow([txn_date, location, category, channel, product, "Sales", revenue])
            rows_written += 2

    print(f"Wrote {rows_written:,} rows ({NUM_TRANSACTIONS:,} transactions) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
