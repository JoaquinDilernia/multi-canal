const TN_API_BASE = 'https://api.tiendanube.com/v1';

export interface TNOrder {
  id: number;
  number: number;
  total: string;
  currency: string;
  customer: {
    email: string;
    name: string;
  };
  status: string;
}

export async function getTNOrder(orderId: string | number): Promise<TNOrder> {
  const res = await fetch(`${TN_API_BASE}/${process.env.TN_STORE_ID}/orders/${orderId}`, {
    headers: {
      'Authentication': `bearer ${process.env.TN_ACCESS_TOKEN}`,
      'User-Agent': process.env.TN_USER_AGENT ?? 'multicanal',
    },
  });

  if (!res.ok) {
    throw new Error(`TN API error ${res.status} para orden ${orderId}`);
  }

  return res.json() as Promise<TNOrder>;
}
