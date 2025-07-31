const { google } = require('googleapis');

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 환경변수에서 서비스 계정 정보 가져오기
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    
    // Google Calendar API 클라이언트 설정
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // 캘린더 ID (본인의 캘린더 ID로 변경 필요)
    const calendarId = process.env.CALENDAR_ID;

    // 오늘부터 30일간의 이벤트 가져오기
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + 30);

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // 개인정보 필터링 함수
    function filterEventData(event) {
      let description = event.description || '';
      
      // 이메일 주소 마스킹
      description = description.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[이메일 숨김]');
      
      // YouCanBook.me 링크 제거
      description = description.replace(/YCBM link ref: .+/g, '');
      description = description.replace(/Create your free account.+/g, '');
      description = description.replace(/Reschedule this booking.+/g, '');
      
      // 프린터 번호 추출
      const printerMatch = event.summary?.match(/(\d+)번?\s*프린터|프린터\s*(\d+)|③프린터/);
      const printerNumber = printerMatch ? (printerMatch[1] || printerMatch[2] || '3') : null;
      
      // 예약자 이름 추출
      const nameMatch = description.match(/\* 예약자 : (.+)/);
      const reserverName = nameMatch ? nameMatch[1].trim() : null;
      
      // 시간 정보
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      
      return {
        id: event.id,
        title: event.summary,
        printerNumber: printerNumber,
        reserverName: reserverName,
        startTime: startTime,
        endTime: endTime,
        filteredDescription: description.trim(),
        originalStart: event.start,
        originalEnd: event.end
      };
    }

    // 필터링된 이벤트 데이터
    const filteredEvents = events.map(filterEventData);

    res.status(200).json({
      success: true,
      events: filteredEvents,
      totalCount: filteredEvents.length
    });

  } catch (error) {
    console.error('Calendar API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch calendar events',
      details: error.message 
    });
  }
}