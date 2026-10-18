import { redirect } from 'next/navigation';

export default function LegacyReferralsRedirect() {
  redirect('/app/referrals');
}
