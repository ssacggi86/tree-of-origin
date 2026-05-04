#!/bin/bash

# [기원의 나무] 자동 실행 스크립트 (Mac용 - 지휘관 모드)
# 이 파일을 더블 클릭하면 서버가 자동으로 가동됩니다.

# 1. 현재 스크립트가 있는 위치로 이동
cd "$(dirname "$0")"

# 2. Node 실행 경로 보강 (Mac용)
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin

echo "------------------------------------------------"
echo "🌳 [기원의 나무: Cyber-Organic] 시스템 가동 중..."
echo "------------------------------------------------"

# 3. 필요한 패키지 설치 확인
if [ ! -d "node_modules" ] || [ ! -d "node_modules/google-spreadsheet" ]; then
    echo "📦 새로운 모듈(Google Sheets 등)을 설치하고 있습니다. 잠시만 기다려주세요..."
    npm install
fi

# 4. 서버 실행
echo "🚀 서버를 시작합니다!"
echo "- 메인 스크린 접속: http://localhost:3000"
echo "- 모바일 접속: http://localhost:3000/mobile"
echo "------------------------------------------------"

# 서버 실행 (오류 발생 시에도 창이 유지되도록 설정)
node server.js || {
    echo ""
    echo "❌ 서버 실행 중 오류가 발생했습니다."
    echo "위의 메시지를 확인해 주세요."
}

echo ""
echo "------------------------------------------------"
read -p "엔터를 누르면 창이 닫힙니다..."
