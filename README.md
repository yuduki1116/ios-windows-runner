# ios-windows v1

## セットアップ
1. GitHubに新しいリポジトリ(例: ios-windows-runner)を作って、`.github/` と `runner/` をそのままpush
   (Settings > Actions > General > Workflow permissions を Read and write に)
2. Personal Access Token(classic)を作る。権限: `repo` + `workflow`
3. WindowsにRust + `cargo install tauri-cli --version "^2"` を入れる
4. このフォルダで `cargo tauri dev` (配布用は `cargo tauri build`)
5. アプリにトークンとリポジトリ名を入れて、**シミュレータ用ビルドの .app を zip したもの**(または .ipa)をアップ → 起動

## 注意
- 実機用の署名済みIPAはシミュレータで動かない(アーキ/プラットフォームが別)。`xcodebuild -sdk iphonesimulator` で作ったものが必要
- ランナーのiOSバージョンは `macos-14` のイメージ依存。無いバージョンは失敗する
- 映像は simctl screenshot ループ(数fps)。もっと滑らかにするなら idb video-stream に差し替え
- 無料枠はジョブ最大6時間、macOSは分数の消費が10倍。GitHub規約的にもグレー寄りなので自己責任で
