//go:build windows

// 간단 오토클릭 (Windows, 외부 의존성 없음)
//   - 지점 추가: 번호가 붙은 빨간 원 -> 끌어서 위치 지정
//   - 지점마다 클릭 간격(초)
//   - 시작/정지: 버튼 또는 F8
//   - 저장/불러오기: JSON 파일 (파이썬판과 같은 형식)
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	radius      = 20
	minInterval = 0.05
	maxPoints   = 90

	idAdd, idSave, idLoad, idStart = 1, 2, 3, 4
	idDelBase, idEditBase          = 100, 200
	vkF8                           = 0x77
	timerID                        = 1
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	gdi32    = syscall.NewLazyDLL("gdi32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	comdlg32 = syscall.NewLazyDLL("comdlg32.dll")

	pRegisterClassEx    = user32.NewProc("RegisterClassExW")
	pCreateWindowEx     = user32.NewProc("CreateWindowExW")
	pDefWindowProc      = user32.NewProc("DefWindowProcW")
	pGetMessage         = user32.NewProc("GetMessageW")
	pTranslateMessage   = user32.NewProc("TranslateMessage")
	pDispatchMessage    = user32.NewProc("DispatchMessageW")
	pPostQuitMessage    = user32.NewProc("PostQuitMessage")
	pShowWindow         = user32.NewProc("ShowWindow")
	pDestroyWindow      = user32.NewProc("DestroyWindow")
	pMoveWindow         = user32.NewProc("MoveWindow")
	pSetWindowPos       = user32.NewProc("SetWindowPos")
	pGetWindowRect      = user32.NewProc("GetWindowRect")
	pAdjustWindowRect   = user32.NewProc("AdjustWindowRect")
	pSetWindowText      = user32.NewProc("SetWindowTextW")
	pGetWindowText      = user32.NewProc("GetWindowTextW")
	pSendMessage        = user32.NewProc("SendMessageW")
	pLoadCursor         = user32.NewProc("LoadCursorW")
	pSetTimer           = user32.NewProc("SetTimer")
	pRegisterHotKey     = user32.NewProc("RegisterHotKey")
	pMessageBox         = user32.NewProc("MessageBoxW")
	pSetCursorPos       = user32.NewProc("SetCursorPos")
	pMouseEvent         = user32.NewProc("mouse_event")
	pGetSystemMetrics   = user32.NewProc("GetSystemMetrics")
	pSetLayeredAttrs    = user32.NewProc("SetLayeredWindowAttributes")
	pBeginPaint         = user32.NewProc("BeginPaint")
	pEndPaint           = user32.NewProc("EndPaint")
	pInvalidateRect     = user32.NewProc("InvalidateRect")
	pDrawText           = user32.NewProc("DrawTextW")
	pSetProcessDPIAware = user32.NewProc("SetProcessDPIAware")

	pGetStockObject   = gdi32.NewProc("GetStockObject")
	pCreateSolidBrush = gdi32.NewProc("CreateSolidBrush")
	pCreatePen        = gdi32.NewProc("CreatePen")
	pCreateFont       = gdi32.NewProc("CreateFontW")
	pSelectObject     = gdi32.NewProc("SelectObject")
	pEllipse          = gdi32.NewProc("Ellipse")
	pSetBkMode        = gdi32.NewProc("SetBkMode")
	pSetTextColor     = gdi32.NewProc("SetTextColor")

	pGetModuleHandle = kernel32.NewProc("GetModuleHandleW")
	pGetOpenFileName = comdlg32.NewProc("GetOpenFileNameW")
	pGetSaveFileName = comdlg32.NewProc("GetSaveFileNameW")
)

type wndClassEx struct {
	Size       uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   uintptr
	Icon       uintptr
	Cursor     uintptr
	Background uintptr
	MenuName   *uint16
	ClassName  *uint16
	IconSm     uintptr
}

type msg struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      [2]int32
}

type rect struct{ Left, Top, Right, Bottom int32 }

type paintStruct struct {
	Hdc      uintptr
	Erase    int32
	Rc       rect
	Restore  int32
	IncUpd   int32
	Reserved [32]byte
}

type openFileName struct {
	StructSize    uint32
	Owner         uintptr
	Instance      uintptr
	Filter        *uint16
	CustomFilter  *uint16
	MaxCustFilter uint32
	FilterIndex   uint32
	File          *uint16
	MaxFile       uint32
	FileTitle     *uint16
	MaxFileTitle  uint32
	InitialDir    *uint16
	Title         *uint16
	Flags         uint32
	FileOffset    uint16
	FileExtension uint16
	DefExt        *uint16
	CustData      uintptr
	Hook          uintptr
	TemplateName  *uint16
	PvReserved    uintptr
	DwReserved    uint32
	FlagsEx       uint32
}

type point struct {
	x, y     int
	interval string
	hwnd     uintptr
	period   time.Duration
	next     time.Time
}

type row struct{ label, edit, unit, coord, del uintptr }

type saveFile struct {
	Points []savePoint `json:"points"`
}
type savePoint struct {
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Interval string `json:"interval"`
}

var (
	points   []*point
	rows     []row
	running  bool
	mainWnd  uintptr
	btnStart uintptr
	status   uintptr
	guiFont  uintptr
	numFont  uintptr
	redBrush uintptr
	whitePen uintptr
	keep     [512]*uint16
	keepIdx  int
)

// w는 문자열을 UTF-16 포인터(uintptr)로 바꾼다. GC로 사라지지 않도록 잠시 붙잡아 둔다.
func w(s string) uintptr {
	p, _ := syscall.UTF16PtrFromString(s)
	keep[keepIdx%len(keep)] = p
	keepIdx++
	return uintptr(unsafe.Pointer(p))
}

func call(p *syscall.LazyProc, a ...uintptr) uintptr {
	r, _, _ := p.Call(a...)
	return r
}

func rgb(r, g, b uint32) uintptr { return uintptr(r | g<<8 | b<<16) }

func msgBox(text string, flags uintptr) {
	call(pMessageBox, mainWnd, w(text), w("오토클릭"), flags)
}

func setText(h uintptr, s string) { call(pSetWindowText, h, w(s)) }

func getText(h uintptr) string {
	var buf [64]uint16
	call(pGetWindowText, h, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	return syscall.UTF16ToString(buf[:])
}

func ctl(class, text string, style uint32, x, y, wd, ht int, id int) uintptr {
	h := call(pCreateWindowEx, 0, w(class), w(text), uintptr(0x50000000|style),
		uintptr(x), uintptr(y), uintptr(wd), uintptr(ht), mainWnd, uintptr(id), 0, 0)
	call(pSendMessage, h, 0x30, guiFont, 1) // WM_SETFONT
	return h
}

func coordText(p *point) string { return fmt.Sprintf("(%d, %d)", p.x, p.y) }

func indexOf(h uintptr) int {
	for i, p := range points {
		if p.hwnd == h {
			return i
		}
	}
	return -1
}

// ---------- 지점 ----------

func addPoint(x, y int, interval string) {
	if len(points) >= maxPoints {
		return
	}
	p := &point{x: x, y: y, interval: interval}
	p.hwnd = call(pCreateWindowEx, 0x80088, // LAYERED|TOPMOST|TOOLWINDOW
		w("ACCircle"), w(""), 0x80000000, // WS_POPUP
		uintptr(x-radius), uintptr(y-radius), 2*radius, 2*radius, 0, 0, 0, 0)
	call(pSetLayeredAttrs, p.hwnd, rgb(1, 1, 1), 0, 1) // 색상키 투명
	call(pShowWindow, p.hwnd, 4)                       // SW_SHOWNOACTIVATE
	points = append(points, p)
	rebuild()
}

func removePoint(i int) {
	syncIntervals()
	call(pDestroyWindow, points[i].hwnd)
	points = append(points[:i], points[i+1:]...)
	rebuild()
}

func syncIntervals() {
	for i, r := range rows {
		if i < len(points) {
			points[i].interval = getText(r.edit)
		}
	}
}

func rebuild() {
	syncIntervals()
	for _, r := range rows {
		for _, h := range []uintptr{r.label, r.edit, r.unit, r.coord, r.del} {
			call(pDestroyWindow, h)
		}
	}
	rows = nil
	for i, p := range points {
		y := 45 + i*28
		rows = append(rows, row{
			label: ctl("STATIC", fmt.Sprintf("%d번", i+1), 0, 10, y+4, 40, 20, 0),
			edit:  ctl("EDIT", p.interval, 0x800000|0x2|0x80, 55, y+1, 60, 22, idEditBase+i),
			unit:  ctl("STATIC", "초마다", 0, 122, y+4, 50, 20, 0),
			coord: ctl("STATIC", coordText(p), 0, 178, y+4, 110, 20, 0),
			del:   ctl("BUTTON", "삭제", 0, 290, y, 60, 24, idDelBase+i),
		})
		call(pInvalidateRect, p.hwnd, 0, 1)
	}
	y := 45 + len(points)*28 + 8
	call(pMoveWindow, btnStart, 10, uintptr(y), 340, 36, 1)
	call(pMoveWindow, status, 10, uintptr(y+42), 340, 20, 1)
	rc := rect{0, 0, 360, int32(y + 70)}
	call(pAdjustWindowRect, uintptr(unsafe.Pointer(&rc)), 0xCA0000|0x80000, 0) // CAPTION|SYSMENU
	call(pSetWindowPos, mainWnd, 0, 0, 0, uintptr(rc.Right-rc.Left), uintptr(rc.Bottom-rc.Top), 0x16)
}

// ---------- 저장/불러오기 ----------

func exeDir() string {
	if p, err := os.Executable(); err == nil {
		return filepath.Dir(p)
	}
	return "."
}

func fileDialog(save bool) string {
	var buf [520]uint16
	if save {
		copy(buf[:], syscall.StringToUTF16("autoclicker_settings.json"))
	}
	filter := append(syscall.StringToUTF16("JSON 설정 파일 (*.json)"), syscall.StringToUTF16("*.json")...)
	filter = append(filter, 0)
	ofn := openFileName{
		Owner:       mainWnd,
		Filter:      &filter[0],
		FilterIndex: 1,
		File:        &buf[0],
		MaxFile:     uint32(len(buf)),
		InitialDir:  syscall.StringToUTF16Ptr(exeDir()),
		DefExt:      syscall.StringToUTF16Ptr("json"),
	}
	ofn.StructSize = uint32(unsafe.Sizeof(ofn))
	var ok uintptr
	if save {
		ofn.Flags = 0x2 | 0x8 | 0x80000 // OVERWRITEPROMPT|NOCHANGEDIR|EXPLORER
		ok = call(pGetSaveFileName, uintptr(unsafe.Pointer(&ofn)))
	} else {
		ofn.Flags = 0x1000 | 0x800 | 0x8 | 0x80000 // FILEMUSTEXIST|PATHMUSTEXIST|NOCHANGEDIR|EXPLORER
		ok = call(pGetOpenFileName, uintptr(unsafe.Pointer(&ofn)))
	}
	if ok == 0 {
		return ""
	}
	return syscall.UTF16ToString(buf[:])
}

func savePoints() {
	path := fileDialog(true)
	if path == "" {
		return
	}
	syncIntervals()
	var sf saveFile
	for _, p := range points {
		sf.Points = append(sf.Points, savePoint{p.x, p.y, p.interval})
	}
	data, _ := json.MarshalIndent(sf, "", "  ")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		msgBox("저장하지 못했습니다: "+err.Error(), 0x10)
		return
	}
	setText(status, "저장했습니다")
}

func loadPoints() {
	path := fileDialog(false)
	if path == "" {
		return
	}
	data, err := os.ReadFile(path)
	var sf saveFile
	if err == nil {
		err = json.Unmarshal(data, &sf)
	}
	if err != nil {
		msgBox("설정 파일을 읽을 수 없습니다.", 0x10)
		return
	}
	for _, p := range points {
		call(pDestroyWindow, p.hwnd)
	}
	points = nil
	rebuild()
	for _, sp := range sf.Points {
		addPoint(sp.X, sp.Y, sp.Interval)
	}
	setText(status, "불러왔습니다")
}

// ---------- 실행 ----------

func click(x, y int) {
	call(pSetCursorPos, uintptr(x), uintptr(y))
	call(pMouseEvent, 0x2, 0, 0, 0, 0)
	call(pMouseEvent, 0x4, 0, 0, 0, 0)
}

func toggle() {
	if running {
		stop()
	} else {
		start()
	}
}

func start() {
	if len(points) == 0 {
		msgBox("지점을 먼저 추가하세요.", 0x40)
		return
	}
	syncIntervals()
	now := time.Now()
	for i, p := range points {
		v, err := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(p.interval), ",", "."), 64)
		if err != nil || v < minInterval {
			msgBox(fmt.Sprintf("%d번 간격을 %g초 이상의 숫자로 입력하세요.", i+1, minInterval), 0x10)
			return
		}
		p.period = time.Duration(v * float64(time.Second))
		p.next = now.Add(p.period)
	}
	running = true
	for _, p := range points {
		call(pShowWindow, p.hwnd, 0) // 원이 클릭을 가로채지 않도록 숨김
	}
	setText(btnStart, "정지 (F8)")
	setText(status, "실행 중 - F8로 정지")
	call(pShowWindow, mainWnd, 6) // SW_MINIMIZE
}

func stop() {
	running = false
	for _, p := range points {
		call(pShowWindow, p.hwnd, 4)
	}
	call(pShowWindow, mainWnd, 9) // SW_RESTORE
	setText(btnStart, "시작 (F8)")
	setText(status, "정지됨")
}

func tick() {
	now := time.Now()
	for _, p := range points {
		if !now.Before(p.next) {
			click(p.x, p.y)
			p.next = now.Add(p.period)
		}
	}
}

// ---------- 창 프로시저 ----------

func mainProc(hwnd, m, wp, lp uintptr) uintptr {
	switch m {
	case 0x111: // WM_COMMAND
		id, notify := int(wp&0xffff), int(wp>>16)
		if notify != 0 {
			break
		}
		switch {
		case id == idAdd:
			n := len(points)
			addPoint(int(call(pGetSystemMetrics, 0))/2+50*n, int(call(pGetSystemMetrics, 1))/2+50*n, "1.0")
		case id == idSave:
			savePoints()
		case id == idLoad:
			loadPoints()
		case id == idStart:
			toggle()
		case id >= idDelBase && id < idEditBase && id-idDelBase < len(points):
			removePoint(id - idDelBase)
		}
		return 0
	case 0x113: // WM_TIMER
		if running {
			tick()
		}
		return 0
	case 0x312: // WM_HOTKEY
		toggle()
		return 0
	case 0x2: // WM_DESTROY
		call(pPostQuitMessage, 0)
		return 0
	}
	return call(pDefWindowProc, hwnd, m, wp, lp)
}

func circleProc(hwnd, m, wp, lp uintptr) uintptr {
	switch m {
	case 0x84: // WM_NCHITTEST -> 제목줄처럼 취급해서 끌어 옮길 수 있게
		return 2
	case 0x3: // WM_MOVE
		if i := indexOf(hwnd); i >= 0 {
			var rc rect
			call(pGetWindowRect, hwnd, uintptr(unsafe.Pointer(&rc)))
			points[i].x, points[i].y = int(rc.Left)+radius, int(rc.Top)+radius
			if i < len(rows) {
				setText(rows[i].coord, coordText(points[i]))
			}
		}
		return 0
	case 0xF: // WM_PAINT
		var ps paintStruct
		hdc := call(pBeginPaint, hwnd, uintptr(unsafe.Pointer(&ps)))
		call(pSelectObject, hdc, redBrush)
		call(pSelectObject, hdc, whitePen)
		call(pEllipse, hdc, 2, 2, 2*radius-2, 2*radius-2)
		call(pSetBkMode, hdc, 1)
		call(pSetTextColor, hdc, rgb(255, 255, 255))
		call(pSelectObject, hdc, numFont)
		rc := rect{0, 0, 2 * radius, 2 * radius}
		call(pDrawText, hdc, w(strconv.Itoa(indexOf(hwnd)+1)), ^uintptr(0), uintptr(unsafe.Pointer(&rc)), 0x25)
		call(pEndPaint, hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	}
	return call(pDefWindowProc, hwnd, m, wp, lp)
}

func registerClass(name string, proc uintptr, bg uintptr) {
	inst := call(pGetModuleHandle, 0)
	cur := call(pLoadCursor, 0, 32512)
	wc := wndClassEx{
		WndProc: proc, Instance: inst, Cursor: cur, Background: bg,
		ClassName: syscall.StringToUTF16Ptr(name),
	}
	wc.Size = uint32(unsafe.Sizeof(wc))
	call(pRegisterClassEx, uintptr(unsafe.Pointer(&wc)))
}

func main() {
	runtime.LockOSThread()
	call(pSetProcessDPIAware)

	guiFont = call(pGetStockObject, 17) // DEFAULT_GUI_FONT
	numFont = call(pCreateFont, ^uintptr(18), 0, 0, 0, 700, 0, 0, 0, 1, 0, 0, 0, 0, w("Malgun Gothic"))
	redBrush = call(pCreateSolidBrush, rgb(255, 59, 48))
	whitePen = call(pCreatePen, 0, 2, rgb(255, 255, 255))
	colorKey := call(pCreateSolidBrush, rgb(1, 1, 1))

	registerClass("ACMain", syscall.NewCallback(mainProc), 16) // COLOR_BTNFACE+1
	registerClass("ACCircle", syscall.NewCallback(circleProc), colorKey)

	mainWnd = call(pCreateWindowEx, 0x8, // TOPMOST
		w("ACMain"), w("오토클릭"), uintptr(0xCA0000|0x80000|0x10000000), // CAPTION|SYSMENU|VISIBLE
		200, 200, 380, 200, 0, 0, 0, 0)

	ctl("BUTTON", "+ 지점 추가", 0, 10, 8, 100, 28, idAdd)
	ctl("BUTTON", "저장", 0, 125, 8, 70, 28, idSave)
	ctl("BUTTON", "불러오기", 0, 200, 8, 80, 28, idLoad)
	btnStart = ctl("BUTTON", "시작 (F8)", 0, 10, 60, 340, 36, idStart)
	status = ctl("STATIC", "원을 끌어서 위치를 정하세요", 0x1, 10, 100, 340, 20, 0) // SS_CENTER

	if call(pRegisterHotKey, mainWnd, 1, 0, vkF8) == 0 {
		setText(status, "F8 단축키를 쓸 수 없습니다 (다른 프로그램이 사용 중)")
	}
	call(pSetTimer, mainWnd, timerID, 10, 0)
	rebuild()

	var m msg
	for int32(call(pGetMessage, uintptr(unsafe.Pointer(&m)), 0, 0, 0)) > 0 {
		call(pTranslateMessage, uintptr(unsafe.Pointer(&m)))
		call(pDispatchMessage, uintptr(unsafe.Pointer(&m)))
	}
}
