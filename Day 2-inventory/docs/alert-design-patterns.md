# 在庫アラート機能：設計パターン比較

## 3つのパターン

### Pattern A: Observer（イベント駆動）
在庫変動のたびにオブザーバーへ通知し、閾値チェックを即座に実行する。

```
stockIn/stockOut → notify(observers) → checkThreshold() → alert!
```

### Pattern B: Polling（定期ポーリング）
スケジューラで定期的に全閾値を走査し、アラートを出力する。

```
setInterval(checkAllThresholds, 60_000) → SELECT ... WHERE qty < min
```

### Pattern C: Event Sourcing（イベントソーシング）
全在庫変動をイベントログとして保存し、任意の時点でリプレイして状態を再構築する。

```
append(StockMovedEvent) → replay(events) → computeState() → checkAlerts()
```

## 比較表

| 観点 | Observer | Polling | Event Sourcing |
|------|----------|---------|----------------|
| リアルタイム性 | ◎ 即時 | △ 遅延あり（間隔依存） | ○ リプレイ次第 |
| 実装コスト | ○ 中程度 | ◎ 低い | △ 高い |
| スケーラビリティ | ○ 中（通知数に比例） | ○ 中（全レコード走査） | ◎ 高い（イベント追記のみ） |
| デバッグ容易性 | △ コールバック追跡が必要 | ◎ SQL一発で状態確認 | ○ イベントログで追跡可能 |
| 既存コードへの影響 | △ stockIn/Out に通知ロジック追加 | ◎ 追加モジュールのみ | △ データモデル変更必要 |
| CLIとの相性 | △ 常駐プロセス不要だが無駄 | △ CLIは1回限り実行 | ○ リプレイ可能 |

## 選定：Polling パターン（Pattern B）

### 選定理由
1. **CLIアプリケーションとの相性** — CLI は実行のたびにプロセスが終了する。Observer パターンの常駐前提は不向き
2. **実装のシンプルさ** — SQL一発で `current < min` を検出できる。既存の `stock_thresholds` テーブルをそのまま利用
3. **デバッグ容易性** — `SELECT * FROM stock_thresholds t JOIN inventory i ...` で状態を直接確認可能
4. **段階的拡張** — 将来的に API サーバー化した場合、Polling → Observer への移行は容易

### 採用しなかった理由

**Observer を採用しなかった理由：**
- CLI は一度きりの実行で終了するため、オブザーバー登録→通知のライフサイクルが無駄
- stockIn/stockOut の各関数にアラート通知ロジックを組み込む必要があり、モジュール結合度が上がる

**Event Sourcing を採用しなかった理由：**
- 在庫管理の規模（小〜中）に対して設計が過剰
- `stock_movements` テーブルが既にイベントログ的な役割を持つが、完全な ES に再設計するコストは見合わない
- CQRSやプロジェクションの仕組みを構築する必要があり、学習コストが高い

## 実装結果
現在の実装（`src/modules/alerts.ts`）は Polling パターンを採用：
- `getAlerts()` を呼び出すたびに SQL で現在在庫と閾値を比較
- CLI の `stock alerts` コマンドでオンデマンド実行
- テスト 11 件全て Green
