# MiraCosta Monitor

東京ディズニーシー・ホテルミラコスタのキャンセル空室を定期確認します。

- 宿泊日: 2027-01-17
- 大人: 2名
- 子供: 2名（1歳、7歳）
- 対象: ポルト・パラディーゾ・サイド
- 自動予約: しない

GitHub Actions が毎時7分に実行します。Actions画面から手動実行もできます。

## 通知
空室検知時は ntfy.sh に通知します。
Settings → Secrets and variables → Actions → New repository secret で NTFY_TOPIC を登録してください。

サイトにアクセスできない、対象セクションが見つからない、構造が変わった場合は空室と誤判定せず失敗します。
予約ボタンのクリックや予約処理はコードに含めていません。
