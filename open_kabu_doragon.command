#!/bin/zsh

set -u

PROJECT_DIR="/Users/okamoto/kabu_doragon"
PORT="8010"
URL="http://127.0.0.1:${PORT}/index.html"
LOG_DIR="${PROJECT_DIR}/.tmp"
LOG_FILE="${LOG_DIR}/http-server-${PORT}.log"

mkdir -p "${LOG_DIR}"

print_status() {
  printf '%s\n' "$1"
}

wait_for_enter() {
  printf '\nEnterキーで閉じます...'
  read -r _
}

is_server_responding() {
  curl --silent --show-error --fail --max-time 2 "${URL}" >/dev/null 2>&1
}

is_port_in_use() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

cd "${PROJECT_DIR}" || {
  print_status "作業フォルダに移動できません: ${PROJECT_DIR}"
  wait_for_enter
  exit 1
}

if is_server_responding; then
  print_status "既存サーバーを検出しました。ブラウザで開きます。"
  open "${URL}"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  print_status "Python 3 が必要です。'python3' コマンドを使えるようにしてください。"
  wait_for_enter
  exit 1
fi

if is_port_in_use; then
  print_status "ポート ${PORT} は使用中ですが、${URL} に応答がありません。"
  print_status "別のプロセスが ${PORT} を使っている可能性があります。"
  wait_for_enter
  exit 1
fi

print_status "ローカルサーバーを起動します..."
nohup python3 -m http.server "${PORT}" --bind 127.0.0.1 >"${LOG_FILE}" 2>&1 &

for _ in {1..20}; do
  if is_server_responding; then
    print_status "起動しました。ブラウザで開きます。"
    open "${URL}"
    exit 0
  fi
  sleep 0.5
done

print_status "サーバー起動がタイムアウトしました。"
print_status "ログ: ${LOG_FILE}"
wait_for_enter
exit 1
