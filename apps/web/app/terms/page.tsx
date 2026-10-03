import { InfoPage, infoMetadata } from '@/components/InfoPage';

export function generateMetadata() {
  return infoMetadata('terms');
}

export default function Page() {
  return <InfoPage name="terms" />;
}
