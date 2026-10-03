import { InfoPage, infoMetadata } from '@/components/InfoPage';

export function generateMetadata() {
  return infoMetadata('privacy');
}

export default function Page() {
  return <InfoPage name="privacy" />;
}
