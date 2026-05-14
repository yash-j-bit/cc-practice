import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Server Action のモック
vi.mock('@/app/products/actions', () => ({
  createProductAction: vi.fn().mockResolvedValue({ ok: true, data: { id: 1 } }),
  updateProductAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

// toast のモック
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Base UI の Dialog を jsdom 向けにシンプルなラッパーで代替
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ render: r }: { render: React.ReactElement }) => r,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ProductFormDialog } from './product-form-dialog';
import { createProductAction } from '@/app/products/actions';

const mockCreate = vi.mocked(createProductAction);

describe('ProductFormDialog — 商品追加フォーム', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SKU が空の場合にバリデーションエラーが表示される', async () => {
    const user = userEvent.setup();
    render(<ProductFormDialog trigger={<button>ダイアログを開く</button>} />);

    // ダイアログは常に表示されている（モックのため）
    // SKU は空（デフォルト ''）のまま送信
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(await screen.findByText('SKU は必須です')).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('商品名が空の場合にバリデーションエラーが表示される', async () => {
    const user = userEvent.setup();
    render(<ProductFormDialog trigger={<button>ダイアログを開く</button>} />);

    // SKU を入力、商品名は空のまま
    await user.type(screen.getByPlaceholderText('SKU-001'), 'SKU-TEST');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(await screen.findByText('商品名は必須です')).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('正しいデータで送信すると createProductAction が呼ばれる', async () => {
    const user = userEvent.setup();
    render(<ProductFormDialog trigger={<button>ダイアログを開く</button>} />);

    await user.type(screen.getByPlaceholderText('SKU-001'), 'SKU-999');
    await user.type(screen.getByLabelText('商品名'), 'テスト商品');

    await user.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'SKU-999', name: 'テスト商品' }),
      );
    });
  });

  it('編集モードでは updateProductAction が呼ばれる', async () => {
    const { updateProductAction } = await import('@/app/products/actions');
    const mockUpdate = vi.mocked(updateProductAction);

    const existingProduct = {
      id: 5,
      sku: 'SKU-005',
      name: '既存商品',
      description: null,
      price: 1000,
      cost: 500,
      minStock: 10,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const user = userEvent.setup();
    render(
      <ProductFormDialog
        trigger={<button>編集</button>}
        product={existingProduct}
      />,
    );

    // 更新ボタンをクリック（既存データのまま）
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ sku: 'SKU-005', name: '既存商品' }),
      );
    });
  });
});
