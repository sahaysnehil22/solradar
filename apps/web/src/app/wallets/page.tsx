import { redirect } from 'next/navigation';

export default function LegacyWalletsRedirect() {
  redirect('/app/wallets');
}
