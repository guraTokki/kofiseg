// backend/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = 3001;
const FILES_DIR = path.join(__dirname, 'files');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// uploads 디렉토리가 없으면 생성
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS 요청 처리 (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    if (pathname === '/api/files') {
        fs.readdir(FILES_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: '파일 목록 오류' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(files));
        });

    } else if (pathname === '/api/uploads') {
        if (req.method === 'GET') {
            // 업로드된 파일 목록 반환
            fs.readdir(UPLOADS_DIR, (err, files) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: '업로드 파일 목록 오류' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(files));
            });
        } else if (req.method === 'POST') {
            // 파일 업로드 처리
            let body = Buffer.alloc(0);
            let filename = '';
            let boundary = '';
            
            // Content-Type에서 boundary 추출
            const contentType = req.headers['content-type'];
            if (contentType && contentType.includes('multipart/form-data')) {
                const boundaryMatch = contentType.match(/boundary=([^;]+)/);
                if (boundaryMatch) {
                    boundary = '--' + boundaryMatch[1];
                }
            }

            req.on('data', chunk => {
                body = Buffer.concat([body, chunk]);
            });

            req.on('end', () => {
                if (!boundary) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid content type' }));
                }

                const bodyStr = body.toString();
                const parts = bodyStr.split(boundary);
                
                for (let part of parts) {
                    if (part.includes('Content-Disposition: form-data')) {
                        const filenameMatch = part.match(/filename="([^"]+)"/);
                        if (filenameMatch) {
                            filename = filenameMatch[1];
                            // 헤더와 내용 분리 (빈 줄 기준)
                            const contentStart = part.indexOf('\r\n\r\n');
                            if (contentStart !== -1) {
                                const fileContent = part.substring(contentStart + 4);
                                // 마지막 경계 제거
                                const cleanContent = fileContent.replace(/\r\n--$/, '');
                                
                                const filepath = path.join(UPLOADS_DIR, filename);
                                fs.writeFile(filepath, cleanContent, 'binary', (err) => {
                                    if (err) {
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        return res.end(JSON.stringify({ error: '파일 저장 실패' }));
                                    }
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ success: true, filename }));
                                });
                                return;
                            }
                        }
                    }
                }
                
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '파일을 찾을 수 없습니다' }));
            });
        }

    } else if (pathname === '/api/download') {
        const query = querystring.parse(parsedUrl.query);
        const filename = query.file;
        const source = query.source || 'files'; // 'files' 또는 'uploads'
        const baseDir = source === 'uploads' ? UPLOADS_DIR : FILES_DIR;
        const filepath = path.join(baseDir, filename);

        if (!filepath.startsWith(baseDir)) {
            res.writeHead(400);
            return res.end('잘못된 접근입니다.');
        }

        fs.stat(filepath, (err, stat) => {
            if (err || !stat.isFile()) {
                res.writeHead(404);
                return res.end('파일 없음');
            }

            res.writeHead(200, {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/octet-stream'
            });

            fs.createReadStream(filepath).pipe(res);
        });

    } else if (pathname === '/api/view-file') {
        const query = querystring.parse(parsedUrl.query);
        const filename = query.file;
        const source = query.source || 'files';
        const baseDir = source === 'uploads' ? UPLOADS_DIR : FILES_DIR;
        const filepath = path.join(baseDir, filename);

        if (!filepath.startsWith(baseDir)) {
            res.writeHead(400);
            return res.end('잘못된 접근입니다.');
        }

        fs.readFile(filepath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: '파일 읽기 실패' }));
            }

            // 파일 확장자에 따라 처리
            const ext = path.extname(filename).toLowerCase();
            let processedData = data;

            if (ext === '.csv') {
                const lines = data.trim().split('\n');
                const rows = lines.map(line => line.split(','));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ type: 'csv', data: rows }));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ type: 'text', data: processedData }));
        });

    } else if (pathname === '/api/csv') {
        const csvPath = path.join(FILES_DIR, 'sample.csv');

        fs.readFile(csvPath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('CSV 파일 읽기 실패');
            }

            const lines = data.trim().split('\n');
            const rows = lines.map(line => line.split(','));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rows));
        });

    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`API 서버 실행 중: http://localhost:${PORT}`);
});