# ハエの脳にサイコロを振らせてみた

ショウジョウバエに着想を得た簡易神経回路シミュレーションが、ブラウザ上でサイコロを振るタイミングを決める実験です。ビルド工程や外部ライブラリは不要で、GitHub Pagesからそのまま配信できます。

## 重要な説明

これは生きたハエの脳や完全なコネクトームのシミュレーションではありません。[flybrain-robot-bridge](https://github.com/Frankweb33/flybrain-robot-bridge) の `MockBrain` にある、8つの手設計されたリーキーな活動グループの考え方と更新式をブラウザ向けに移植しています。

- 神経モデルが決めるもの: サイコロを振るタイミング
- サイコロの出目: Web Crypto APIによる乱数
- コネクトームデータ: 使用していません
- 実際のハエ・ロボット: 使用していません

## ローカルで見る

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## GitHub Pages

リポジトリの Settings → Pages で、`Deploy from a branch`、対象ブランチのルートを選ぶと公開できます。

## Attribution

The browser neural model is adapted from the eight-group `MockBrain` concept in [Frankweb33/Himas1211's flybrain-robot-bridge](https://github.com/Frankweb33/flybrain-robot-bridge), used under the MIT License. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

MIT. See [LICENSE](LICENSE).
