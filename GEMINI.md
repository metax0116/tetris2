# Project Overview: Mario 64-style 3D Action Game (tetris2)

このプロジェクトは、リポジトリ名こそ `tetris2` ですが、実態は Three.js を使用したマリオ64風の3Dアクションゲームです。プレイヤーは赤い立方体を操作し、空中に浮かぶプラットフォームを渡り歩きながら、コインやスターを収集し、敵を避けながら進みます。

## 技術スタック
- **Engine:** [Three.js](https://threejs.org/) (r128)
- **Language:** JavaScript (Vanilla JS), HTML5, CSS3
- **Rendering:** WebGL

## 実行方法
プロジェクトのルートディレクトリでローカルサーバーを起動し、ブラウザでアクセスしてください。

```bash
# 例: serveパッケージを使用する場合
npx serve .
```

ブラウザで `http://localhost:3000` (または表示されたポート) を開きます。

## 操作方法
- **移動:** `WASD` または `矢印キー`
- **ジャンプ:** `SPACE` (最大3回までの空中ジャンプ、三段跳びが可能)
- **ダッシュ:** `SHIFT`
- **カメラ操作:** マウス移動 または `矢印キー`
- **カメラリセット:** `C` キー

## アーキテクチャと主要ファイル
- **index.html:** ゲームのレイアウト、HUD (コイン/スター/体力表示)、および Three.js のレンダリング領域を定義します。
- **game.js:** ゲームの全ロジックを含みます。
  - `Player` クラス: 物理演算、入力制御、ジャンプシステム（三段跳び、幅跳び等）。
  - `Coin`, `Enemy`, `Star` クラス: オブジェクトの挙動と収集判定。
  - `checkCollisionsWithPlatforms`: プラットフォームとの詳細な衝突判定。
  - `createLevel`: 静的なプラットフォームを配置するレベル生成ロジック。
  - `updateCamera`: プレイヤーを追従するTPSスタイルのカメラ制御。

## 開発のヒント
- **レベルの追加:** `createLevel` 関数内に `createPlatform(x, y, z, width, height, depth, color)` を追加することで、新しい足場を作成できます。
- **難易度調整:** `Player` クラスの `gravity`, `jumpForce`, `walkSpeed` などの定数を調整することで、操作感を変更できます。
- **敵の挙動:** `Enemy` クラスの `update` メソッドで、プレイヤーを追尾するロジックや移動パターンをカスタマイズできます。
