import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageCard } from '@/components/image-card';
import { makeImage } from './_helpers';

describe('ImageCard', () => {
  it('詳細ページへのリンクと LGTM 画像を描画する', () => {
    render(<ImageCard image={makeImage({ id: 'abc' })} />);

    const link = screen.getByTestId('image-card-link');
    expect(link).toHaveAttribute('href', '/images/abc');

    const img = screen.getByAltText('LGTM');
    expect(img).toHaveAttribute('src', 'https://blob.example.com/lgtm/img-1.webp');
  });

  it('コピーボタン (icon variant) を重ねて描画する', () => {
    render(<ImageCard image={makeImage()} />);

    expect(screen.getByTestId('copy-markdown-button')).toHaveAttribute(
      'aria-label',
      'マークダウンをコピー',
    );
  });
});
