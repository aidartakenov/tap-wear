'use client';

import { ExternalLink, MessageCircle, Phone, Send } from 'lucide-react';
import { formatPrice } from '@/lib/catalog';
import { Product, Store } from '@/lib/types';

interface ContactButtonProps {
  store: Store;
  // When given, the WhatsApp message names the product the buyer is asking about.
  product?: Product;
}

const primary =
  'inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 bg-green-600 text-white hover:bg-green-700';
const secondary =
  'inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground';

export function ContactButton({ store, product }: ContactButtonProps) {
  const message = product
    ? `Здравствуйте! Интересует товар: ${product.title}\nЦена: ${formatPrice(product.priceMinor)}\n${product.sourceUrl}\n\nПодскажите, пожалуйста, наличие и размеры.`
    : 'Здравствуйте! Пишу вам с TopWear.';

  return (
    <div className="space-y-2">
      {store.whatsapp ? (
        <a
          href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={primary}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Написать в WhatsApp
        </a>
      ) : (
        <a href={`tel:${store.phone.replace(/[^\d+]/g, '')}`} className={primary}>
          <Phone className="w-4 h-4 mr-2" />
          Позвонить {store.phone}
        </a>
      )}
      {store.instagram && (
        <a
          href={`https://instagram.com/${store.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className={secondary}
        >
          <Send className="w-4 h-4 mr-2" />
          Instagram магазина
        </a>
      )}
      <a
        href={product ? product.sourceUrl : store.website}
        target="_blank"
        rel="noopener noreferrer"
        className={secondary}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        {product ? 'Открыть на сайте магазина' : 'Сайт магазина'}
      </a>
    </div>
  );
}
