import { redirect } from 'next/navigation';

export default function LegacyTokensRedirect() {
  redirect('/app/discover');
}
