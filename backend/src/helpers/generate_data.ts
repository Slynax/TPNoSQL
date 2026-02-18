import { User, Product, Follow, Purchase } from "../types/models";

interface GenerationParams {
  userCount: number;
  productCount: number;
  maxFollowers: number;
  maxPurchases: number;
}

interface GeneratedData {
  users: User[];
  products: Product[];
  follows: Follow[];
  purchases: Purchase[];
}

const FIRST_NAMES = [
  "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank",
  "Iris", "Jack", "Karen", "Leo", "Mia", "Noah", "Olivia", "Paul",
  "Quinn", "Rita", "Sam", "Tina", "Uma", "Victor", "Wendy", "Xander",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Brown", "Davis", "Wilson", "Moore", "Taylor",
  "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Garcia",
];

const PRODUCT_ADJECTIVES = [
  "Premium", "Classic", "Ultra", "Eco", "Pro", "Smart", "Mega", "Mini",
];

const PRODUCT_NOUNS = [
  "Widget", "Gadget", "Device", "Tool", "Kit", "Pack", "Box", "Set",
  "Module", "Unit", "System", "Component", "Adapter", "Cable", "Screen",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateData(params: GenerationParams): GeneratedData {
  const { userCount, productCount, maxFollowers, maxPurchases } = params;

  const users: User[] = [];
  for (let i = 1; i <= userCount; i++) {
    users.push({
      id: i,
      name: `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)} ${i}`,
    });
  }

  const products: Product[] = [];
  for (let i = 1; i <= productCount; i++) {
    products.push({
      id: i,
      name: `${randomElement(PRODUCT_ADJECTIVES)} ${randomElement(PRODUCT_NOUNS)} ${i}`,
      price: parseFloat((Math.random() * 500 + 1).toFixed(2)),
    });
  }

  const followSet = new Set<string>();
  const follows: Follow[] = [];
  for (let i = 1; i <= userCount; i++) {
    const nbFollows = randomInt(0, maxFollowers);
    for (let j = 0; j < nbFollows; j++) {
      const followedId = randomInt(1, userCount);
      const key = `${i}-${followedId}`;
      if (i !== followedId && !followSet.has(key)) {
        followSet.add(key);
        follows.push({ followerId: i, followedId });
      }
    }
  }

  const purchaseSet = new Set<string>();
  const purchases: Purchase[] = [];
  for (let i = 1; i <= userCount; i++) {
    const nbPurchases = randomInt(0, maxPurchases);
    for (let j = 0; j < nbPurchases; j++) {
      const productId = randomInt(1, productCount);
      const key = `${i}-${productId}`;
      if (!purchaseSet.has(key)) {
        purchaseSet.add(key);
        purchases.push({ userId: i, productId });
      }
    }
  }

  return { users, products, follows, purchases };
}
