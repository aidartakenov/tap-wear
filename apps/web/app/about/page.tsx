import { InfoPage, infoMetadata } from '@/components/InfoPage';

export function generateMetadata() {
  return infoMetadata('about');
}

export default function Page() {
  return <InfoPage name="about" />;
}
