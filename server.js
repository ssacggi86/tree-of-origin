/**
 * [기원의 나무: Cyber-Organic] 실시간 중계 서버
 * ------------------------------------------------
 * 관람객의 모바일 입력(입력창)과 전시장의 메인 스크린(3D 나무)을
 * 실시간으로 연결해주는 중계기 역할을 합니다.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // 모든 접속 허용
});

// --- [환경 설정] ---
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "agry"; 

// --- [데이터 보존 설정] ---
const MESSAGES_PATH = path.join(__dirname, 'messages.json');
const MAX_MESSAGES = 200; // 최대 메시지 유지 개수
let messageHistory = [];  // 메시지 저장소

// 서버 시작 시 기존 메시지 불러오기
try {
    if (fs.existsSync(MESSAGES_PATH)) {
        messageHistory = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf8'));
        console.log(`📜 기존 메시지 ${messageHistory.length}건 복구 완료`);
    }
} catch (e) {
    console.error('❌ 메시지 복구 실패:', e.message);
    messageHistory = [];
}

// 메시지 저장 함수 (비동기 방식으로 변경하여 성능 최적화)
function saveMessages() {
    fs.writeFile(MESSAGES_PATH, JSON.stringify(messageHistory, null, 4), (err) => {
        if (err) console.error('❌ 메시지 저장 실패:', err.message);
    });
}

// --- [모바일 페이지 문구 설정] ---
const CONFIG_PATH = path.join(__dirname, 'config.json');
let mobileConfig = {
    title: "기원의 나무",
    description: "당신의 소망을 은하로 보내주세요.",
    placeholder: "메시지를 입력하세요 (50자 이내)",
    sendBtn: "은하로 송출하기",
    successTitle: "송출이 완료되었습니다",
    successDesc: "당신의 소중한 진심이<br>플레이아데스 성단에 닿았습니다.",
    resetBtn: "처음으로",
    badWords: ["바보", "멍청이", "나쁜말"],
    exhibitionConfig: {
        maxMessages: 30,
        density: 1.0,
        qrImageUrl: "" // 사용자가 준비할 QR 이미지 경로
    }
};

// 파일에서 설정 로드 (기본값과 병합)
try {
    if (fs.existsSync(CONFIG_PATH)) {
        const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        mobileConfig = { ...mobileConfig, ...savedConfig };
        console.log('📖 설정 파일 로드 및 병합 완료');
    }
} catch (e) {
    console.error('❌ 설정 로드 실패:', e.message);
}

// --- [데이터 처리] ---
// (구글 시트 연동 기능이 호퍼 사령관의 명령으로 삭제되었습니다.)

// --- [욕설 필터 설정] ---
function filterContent(text) {
    if (!text) return null;
    const words = mobileConfig.badWords || [];
    const trimmed = text.trim();

    // 1. 금지어(욕설/혐오/폭력) 검사 - 정규화(공백/특문 제거) 후 검증
    const normalized = trimmed.replace(/\s+/g, '').replace(/[!@#$%^&*(),.?":{}|<>_\-+=~`]/g, '');
    
    for (const word of words) {
        if (normalized.includes(word) || trimmed.includes(word)) {
            return "아이들이 보고 있습니다. 예쁜 마음을 보여주세요.";
        }
    }

    // 2. 무의미한 반복 문자 감지 (4회 이상)
    if (/(.)\1{3,}/.test(trimmed)) {
        return "가족들이 지켜보고 있습니다. 어른스러운 진심을 담아주시는 건 어떨까요?";
    }

    // 3. 자음/모음 남용 감지 (40% 초과)
    const jamoMatch = trimmed.match(/[ㄱ-ㅎㅏ-ㅣ]/g) || [];
    if (jamoMatch.length / trimmed.length > 0.4 && trimmed.length > 3) {
        return "의미 없는 자음/모음보다는 당신의 멋진 목소리를 들려주세요.";
    }

    return null; // 필터링 통과 시 null 반환 (에러 없음)
}

// --- [스테틱 파일 경로 설정] ---
// public 폴더 안의 파일들(html, css, js)을 웹사이트처럼 보여줍니다.
app.use(express.static(path.join(__dirname, 'public')));

// 기본 접속 경로 (메인 스크린이 이 주소로 접속)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 모바일 접속 경로 (관람객이 스캔해서 들어오는 주소)
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// 관리자 접속 경로
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- [Socket.io 실시간 연결 로직] ---
io.on('connection', (socket) => {
    console.log('🔗 새로운 접속자 발생:', socket.id);

    // 1. 처음 접속한 기기에 현재까지의 나무 상태(메시지 리스트) 전송
    socket.emit('init_messages', messageHistory);

    socket.on('get_init_messages', () => {
        socket.emit('init_messages', messageHistory);
    });

    // 2. 모바일로부터 메시지 수신
    socket.on('send_message', (data, callback) => {
        // 데이터 필터링 (욕설 제거)
        const errorMsg = filterContent(data.content);
        if (errorMsg) {
            console.log('🚫 메시지 차단됨:', data.content);
            if (callback) callback({ status: 'error', message: errorMsg });
            return;
        }
        
        const newMessage = {
            id: Date.now(),
            content: data.content,
            color: data.color || '#00FFFF', // 기본 시안 네온
            timestamp: new Date()
        };

        // 히스토리 관리 (200개 제한)
        messageHistory.push(newMessage);
        if (messageHistory.length > MAX_MESSAGES) {
            messageHistory.shift(); // 가장 오래된 것 삭제
        }

        // 모든 접속된 기기(메인 스크린 포함)에 메시지 방송!
        io.emit('new_message', newMessage);
        console.log('📩 메시지 중계 완료:', data.content);

        // 파일 저장
        saveMessages();

        // 성공 응답 전송
        if (callback) callback({ status: 'success' });
    });

    // 3. 관리자로부터 삭제 명령 수신
    socket.on('delete_message', (data) => {
        // 비밀번호 확인
        if (data.password !== ADMIN_PASSWORD) {
            socket.emit('admin_error', '비밀번호가 틀렸습니다.');
            return;
        }

        // 히스토리에서 삭제
        messageHistory = messageHistory.filter(m => m.id !== data.messageId);
        saveMessages();
        
        // 모든 클라이언트에 삭제 방송
        io.emit('remove_message', data.messageId);
        console.log('🗑️ 메시지 삭제 완료:', data.messageId);
    });

    // 4. 전체 초기화 명령 수신
    socket.on('reset_messages', (data) => {
        // 비밀번호 확인
        if (data.password !== ADMIN_PASSWORD) {
            socket.emit('admin_error', '비밀번호가 틀렸습니다.');
            return;
        }

        // 히스토리 비우기
        messageHistory = [];
        saveMessages();
        
        // 모든 클라이언트에 초기화 방송
        io.emit('clear_screen');
        console.log('🧹 전체 메시지 초기화 완료');
    });

    // 5. 메시지 수정 명령 수신
    socket.on('edit_message', (data) => {
        // 비밀번호 확인
        if (data.password !== ADMIN_PASSWORD) {
            socket.emit('admin_error', '비밀번호가 틀렸습니다.');
            return;
        }

        // 히스토리에서 찾아서 수정
        const index = messageHistory.findIndex(m => m.id === data.messageId);
        if (index !== -1) {
            messageHistory[index].content = data.newContent;
            saveMessages();
            
            // 모든 클라이언트에 수정 방송
            io.emit('update_message', {
                messageId: data.messageId,
                newContent: data.newContent
            });
            console.log('✏️ 메시지 수정 완료:', data.messageId, '->', data.newContent);
        }
    });

    // 6. 모바일 설정 요청/수정
    socket.on('request_mobile_config', () => {
        console.log('📡 관리자로부터 설정 요청 수신');
        socket.emit('mobile_config_update', mobileConfig);
    });

    socket.emit('mobile_config_update', mobileConfig); // 접속 시 현재 설정 전송

    socket.on('update_mobile_config', (data) => {
        // 비밀번호 확인
        if (data.password !== ADMIN_PASSWORD) {
            socket.emit('admin_error', '비밀번호가 틀렸습니다.');
            return;
        }

        mobileConfig = { ...mobileConfig, ...data.newConfig };
        
        // 파일 저장
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(mobileConfig, null, 4));
            // 모든 모바일 클라이언트에 업데이트 방송
            io.emit('mobile_config_update', mobileConfig);
            console.log('⚙️ 모바일 설정 업데이트 완료');
        } catch (e) {
            console.error('❌ 설정 저장 실패:', e.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ 접속 종료:', socket.id);
    });
});

// 서버 시작!
server.listen(PORT, () => {
    console.log(`
🚀 [기원의 나무] 서버가 가동되었습니다!
------------------------------------------------
- 메인 스크린 접속: http://localhost:${PORT}
- 모바일 접속: http://localhost:${PORT}/mobile
------------------------------------------------
    `);
});
