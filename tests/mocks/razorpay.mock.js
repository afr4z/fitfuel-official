export const createdLinks = [];

export function resetRazorpay() {
  createdLinks.length = 0;
}

export async function createPaymentLink({ amount, description, phone, referenceId }) {
  const link = {
    id: `plink_test_${referenceId}`,
    short_url: `https://rzp.io/test/${referenceId}`,
    amount,
    description,
    phone,
    referenceId,
  };
  createdLinks.push(link);
  return link;
}
