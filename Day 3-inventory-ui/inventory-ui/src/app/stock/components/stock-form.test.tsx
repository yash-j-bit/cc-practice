import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Server Action のモック
vi.mock('@/app/stock/actions', () => ({
  receiveStockAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  shipStockAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

// toast のモック
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Base UI の Select を native <select> で代替（jsdom 対応）
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="" disabled>
      {placeholder}
    </option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

import { StockForm } from './stock-form';
import { receiveStockAction, shipStockAction } from '@/app/stock/actions';

const mockReceive = vi.mocked(receiveStockAction);
const mockShip = vi.mocked(shipStockAction);

const products = [
  {
    id: 1,
    sku: 'SKU-001',
    name: 'ノート A5',
    description: null,
    price: 380,
    cost: 200,
    minStock: 20,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const warehouses = [
  { id: 1, name: '東京倉庫', location: '東京' },
];

describe('StockForm — 在庫操作フォーム', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('入庫登録（type="in"）', () => {
    it('商品未選択で送信するとバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      render(<StockForm type="in" products={products} warehouses={warehouses} />);

      await user.click(screen.getByRole('button', { name: '入庫を登録' }));

      expect(await screen.findByText('商品を選択してください')).toBeInTheDocument();
      expect(mockReceive).not.toHaveBeenCalled();
    });

    it('倉庫未選択で送信するとバリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      render(<StockForm type="in" products={products} warehouses={warehouses} />);

      // 商品を選択、倉庫は未選択のまま
      const selects = screen.getAllByTestId('select');
      await user.selectOptions(selects[0], '1'); // 商品選択

      await user.click(screen.getByRole('button', { name: '入庫を登録' }));

      expect(await screen.findByText('倉庫を選択してください')).toBeInTheDocument();
      expect(mockReceive).not.toHaveBeenCalled();
    });

    it('正しいデータで送信すると receiveStockAction が呼ばれる', async () => {
      const user = userEvent.setup();
      render(<StockForm type="in" products={products} warehouses={warehouses} />);

      const selects = screen.getAllByTestId('select');
      await user.selectOptions(selects[0], '1'); // 商品
      await user.selectOptions(selects[1], '1'); // 倉庫

      // 数量はデフォルト 1 のまま
      await user.click(screen.getByRole('button', { name: '入庫を登録' }));

      await waitFor(() => {
        expect(mockReceive).toHaveBeenCalledWith(
          expect.objectContaining({
            productId: 1,
            warehouseId: 1,
            quantity: 1,
          }),
        );
      });
    });

    it('送信成功後にフォームがリセットされる', async () => {
      const user = userEvent.setup();
      render(<StockForm type="in" products={products} warehouses={warehouses} />);

      const selects = screen.getAllByTestId('select');
      await user.selectOptions(selects[0], '1');
      await user.selectOptions(selects[1], '1');
      await user.click(screen.getByRole('button', { name: '入庫を登録' }));

      await waitFor(() => expect(mockReceive).toHaveBeenCalled());

      // フォームがリセットされ、数量が 1 に戻る
      const qtyInput = screen.getByLabelText('数量') as HTMLInputElement;
      expect(qtyInput.value).toBe('1');
    });
  });

  describe('出庫登録（type="out"）', () => {
    it('正しいデータで送信すると shipStockAction が呼ばれる', async () => {
      const user = userEvent.setup();
      render(<StockForm type="out" products={products} warehouses={warehouses} />);

      const selects = screen.getAllByTestId('select');
      await user.selectOptions(selects[0], '1');
      await user.selectOptions(selects[1], '1');

      await user.click(screen.getByRole('button', { name: '出庫を登録' }));

      await waitFor(() => {
        expect(mockShip).toHaveBeenCalledWith(
          expect.objectContaining({
            productId: 1,
            warehouseId: 1,
            quantity: 1,
          }),
        );
      });
    });
  });
});
