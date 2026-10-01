'use client';

import { MessageCircle, Send } from 'lucide-react';
import { Product } from '@/lib/types';

interface ContactButtonProps {
  product: Product;
}

export function ContactButton({ product }: ContactButtonProps) {
  const generateWhatsAppMessage = () => {
    const message = `Здравствуйте! Интересует товар: ${product.name}\n\nЦена: ${product.priceRange || `${product.price} сом`}\nЦвет: ${product.color}\n\nХотел бы узнать подробности о размерах и наличии.`;
    const encodedMessage = encodeURIComponent(message);
    const phone = product.seller.whatsapp || product.seller.contact.replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  };

  const generateInstagramMessage = () => {
    return `https://instagram.com/${product.seller.instagram}`;
  };

  return (
    <div className="space-y-2">
      <a
        href={generateWhatsAppMessage()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2"
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        Написать в WhatsApp
      </a>
      {product.seller.instagram && (
        <a
          href={generateInstagramMessage()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          <Send className="w-4 h-4 mr-2" />
          Написать в Instagram
        </a>
      )}
    </div>
  );
}
