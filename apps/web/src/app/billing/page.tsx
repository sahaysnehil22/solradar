import { redirect } from 'next/navigation';

export default function LegacyBillingRedirect() {
  redirect('/app/billing');
}
