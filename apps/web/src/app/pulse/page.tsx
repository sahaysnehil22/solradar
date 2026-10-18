import { redirect } from 'next/navigation';

export default function LegacyPulseRedirect() {
  redirect('/app/pulse');
}
