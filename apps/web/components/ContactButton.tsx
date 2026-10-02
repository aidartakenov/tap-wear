'use client';

import { ExternalLink, MessageCircle, Phone, Send } from 'lucide-react';
import { ContactChannel, track } from '@/lib/analytics';
import { formatPrice } from '@/lib/catalog';
import { Store } from '@/lib/types';

interface ContactButtonProps {
  store: Store;
  // When given, the WhatsApp message names the product and variant the buyer chose.
  inquiry?: {
    title: string;
    priceMinor: number;
    size: string | null;
    color: string | null;
    url: string | null;
    productId: string;
    variantId: string | null;
  };
}

const primary =
  'inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 bg-green-600 text-white hover:bg-green-700';
const secondary =
  'inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground';

export function ContactButton({ store, inquiry }: ContactButtonProps) {
  const message = inquiry
    ? [
        `Здравствуйте! Интересует товар: ${inquiry.title}`,
        inquiry.size ? `Размер: ${inquiry.size}` : null,
        inquiry.color ? `Цвет: ${inquiry.color}` : null,
        `Цена: ${formatPrice(inquiry.priceMinor)}`,
        inquiry.url,
        '',
        'Подскажите, пожалуйста, есть ли в наличии?',
      ]
        .filter((line) => line !== null)
        .join('\n')
    : 'Здравствуйте! Пишу вам с TapWear.';
  const link = inquiry?.url ?? store.website;

  // Counted for the store's statistics. A click is an inquiry, not a sale.
  const clicked = (channel: ContactChannel) => () =>
    track(
      'contact_click',
      inquiry
        ? { product_id: inquiry.productId, variant_id: inquiry.variantId ?? undefined, channel }
        : { store_slug: store.slug, channel }
    );

  return (
    <div className="space-y-2">
      {store.whatsapp ? (
        <a
          href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={clicked('whatsapp')}
          className={primary}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Написать в WhatsApp
        </a>
      ) : (
        store.phone && (
          <a
            href={`tel:${store.phone.replace(/[^\d+]/g, '')}`}
            onClick={clicked('phone')}
            className={primary}
          >
            <Phone className="w-4 h-4 mr-2" />
            Позвонить {store.phone}
          </a>
        )
      )}
      {store.instagram && (
        <a
          href={`https://instagram.com/${store.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={clicked('instagram')}
          className={secondary}
        >
          <Send className="w-4 h-4 mr-2" />
          Instagram магазина
        </a>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={clicked('website')}
          className={secondary}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {inquiry ? 'Открыть на сайте магазина' : 'Сайт магазина'}
        </a>
      )}
    </div>
  );
}
