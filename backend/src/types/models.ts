export interface User {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
}

export interface Follow {
  followerId: number;
  followedId: number;
}

export interface Purchase {
  userId: number;
  productId: number;
}
