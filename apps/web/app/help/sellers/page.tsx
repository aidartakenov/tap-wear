import { InfoPage, infoMetadata } from '@/components/InfoPage';

export function generateMetadata() {
  return infoMetadata('sellers');
}

export default function Page() {
  return <InfoPage name="sellers" />;
}
