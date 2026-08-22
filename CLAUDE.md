@AGENTS.md

# Claude Code 固有

プロジェクトの規約は `AGENTS.md` にある。ここには Claude Code にだけ関係することを書く。

## Skill

- `vercel-plugin:react-best-practices` はパフォーマンス最適化に特化している。
  実装中は参照せず、動作するものができてから、計測して遅い箇所にのみ適用する
- `superpowers:*` は user-level に置いてある。この環境で利用できないときは、
  計画のチェックボックスをタスク単位で順に実行し、
  `AGENTS.md` の「レビューを受ける」に該当する変更だけ独立したレビューに回す

## レビュー

`AGENTS.md` の「レビューを受ける」は、この環境では sub-agent に依頼して実施する。
