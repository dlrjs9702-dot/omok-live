"""간단 오토클릭 (Windows 전용, 파이썬 기본 라이브러리만 사용)

- 지점 추가: 번호가 붙은 빨간 원이 나타남 -> 마우스로 끌어서 원하는 위치에 놓기
- 지점마다 클릭 간격(초) 설정
- 시작/정지: 버튼 또는 F8 키 (실행 중에는 창이 최소화되므로 F8로 정지)
- 저장/불러오기: JSON 파일
"""
import ctypes
import json
import os
import sys
import time
import tkinter as tk
from tkinter import filedialog, messagebox

if sys.platform != "win32":
    raise SystemExit("이 프로그램은 Windows 전용입니다.")

user32 = ctypes.windll.user32
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)  # 화면 배율에 상관없이 실제 픽셀 좌표 사용
except Exception:
    user32.SetProcessDPIAware()

HERE = os.path.dirname(os.path.abspath(__file__))
HOTKEY_VK = 0x77  # F8
R = 20  # 원 반지름
MIN_INTERVAL = 0.05
TRANSPARENT = "#010101"


def click(x, y):
    user32.SetCursorPos(int(x), int(y))
    user32.mouse_event(0x0002, 0, 0, 0, 0)  # 왼쪽 버튼 누름
    user32.mouse_event(0x0004, 0, 0, 0, 0)  # 왼쪽 버튼 뗌


class App:
    def __init__(self, root):
        self.root = root
        self.points = []  # {"x","y","var","win","canvas","text","next"}
        self.running = False
        self.hotkey_down = False

        root.title("오토클릭")
        root.attributes("-topmost", True)
        root.resizable(False, False)

        bar = tk.Frame(root)
        bar.pack(fill="x", padx=8, pady=6)
        tk.Button(bar, text="+ 지점 추가", command=self.add_point).pack(side="left")
        tk.Button(bar, text="저장", command=self.save).pack(side="left", padx=(12, 0))
        tk.Button(bar, text="불러오기", command=self.load).pack(side="left", padx=4)

        self.list_frame = tk.Frame(root)
        self.list_frame.pack(fill="x", padx=8)

        self.run_btn = tk.Button(root, text="시작 (F8)", width=20, height=2, command=self.toggle)
        self.run_btn.pack(padx=8, pady=8)
        self.status = tk.Label(root, text="원을 끌어서 위치를 정하세요", fg="gray")
        self.status.pack(pady=(0, 8))

        self.poll_hotkey()
        self.refresh()

    # ---------- 지점 관리 ----------
    def add_point(self, x=None, y=None, interval="1.0"):
        n = len(self.points)
        if x is None:
            x = user32.GetSystemMetrics(0) // 2 + 50 * n
            y = user32.GetSystemMetrics(1) // 2 + 50 * n
        win = tk.Toplevel(self.root)
        win.overrideredirect(True)
        win.attributes("-topmost", True)
        win.attributes("-transparentcolor", TRANSPARENT)
        win.configure(bg=TRANSPARENT)
        win.geometry(f"{2 * R}x{2 * R}+{int(x) - R}+{int(y) - R}")
        canvas = tk.Canvas(win, width=2 * R, height=2 * R, bg=TRANSPARENT, highlightthickness=0)
        canvas.pack()
        canvas.create_oval(2, 2, 2 * R - 2, 2 * R - 2, fill="#ff3b30", outline="white", width=2)
        text = canvas.create_text(R, R, text=str(n + 1), fill="white", font=("Malgun Gothic", 12, "bold"))
        p = {"x": int(x), "y": int(y), "var": tk.StringVar(value=str(interval)),
             "win": win, "canvas": canvas, "text": text, "next": 0.0}
        self.points.append(p)

        def press(e):
            p["dx"], p["dy"] = e.x_root - win.winfo_x(), e.y_root - win.winfo_y()

        def drag(e):
            win.geometry(f"+{e.x_root - p['dx']}+{e.y_root - p['dy']}")
            p["x"], p["y"] = win.winfo_x() + R, win.winfo_y() + R
            self.refresh()

        canvas.bind("<ButtonPress-1>", press)
        canvas.bind("<B1-Motion>", drag)
        self.refresh()

    def remove_point(self, p):
        p["win"].destroy()
        self.points.remove(p)
        self.refresh()

    def refresh(self):
        for w in self.list_frame.winfo_children():
            w.destroy()
        for i, p in enumerate(self.points):
            p["canvas"].itemconfig(p["text"], text=str(i + 1))
            row = tk.Frame(self.list_frame)
            row.pack(fill="x", pady=1)
            tk.Label(row, text=f"{i + 1}번", width=4).pack(side="left")
            tk.Entry(row, textvariable=p["var"], width=7, justify="right").pack(side="left")
            tk.Label(row, text="초마다").pack(side="left")
            tk.Label(row, text=f"({p['x']}, {p['y']})", fg="gray", width=12).pack(side="left")
            tk.Button(row, text="삭제", command=lambda p=p: self.remove_point(p)).pack(side="left")

    # ---------- 저장/불러오기 ----------
    def save(self):
        path = filedialog.asksaveasfilename(
            initialdir=HERE, initialfile="autoclicker_settings.json",
            defaultextension=".json", filetypes=[("JSON", "*.json")])
        if not path:
            return
        data = {"points": [{"x": p["x"], "y": p["y"], "interval": p["var"].get()} for p in self.points]}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self.status.config(text="저장했습니다")

    def load(self):
        path = filedialog.askopenfilename(initialdir=HERE, filetypes=[("JSON", "*.json")])
        if not path:
            return
        try:
            with open(path, encoding="utf-8") as f:
                items = json.load(f)["points"]
            parsed = [(int(i["x"]), int(i["y"]), str(i["interval"])) for i in items]
        except Exception:
            messagebox.showerror("오류", "설정 파일을 읽을 수 없습니다.")
            return
        for p in self.points:
            p["win"].destroy()
        self.points.clear()
        for x, y, interval in parsed:
            self.add_point(x, y, interval)
        self.status.config(text="불러왔습니다")

    # ---------- 실행 ----------
    def toggle(self):
        self.stop() if self.running else self.start()

    def start(self):
        if not self.points:
            messagebox.showinfo("알림", "지점을 먼저 추가하세요.")
            return
        now = time.monotonic()
        for i, p in enumerate(self.points):
            try:
                p["interval"] = float(p["var"].get())
                assert p["interval"] >= MIN_INTERVAL
            except Exception:
                messagebox.showerror("오류", f"{i + 1}번 간격을 {MIN_INTERVAL}초 이상의 숫자로 입력하세요.")
                return
            p["next"] = now + p["interval"]
        self.running = True
        for p in self.points:
            p["win"].withdraw()  # 원이 클릭을 가로채지 않도록 숨김
        self.run_btn.config(text="정지 (F8)")
        self.status.config(text="실행 중 - F8로 정지")
        self.root.iconify()
        self.tick()

    def stop(self):
        self.running = False
        for p in self.points:
            p["win"].deiconify()
        self.root.deiconify()
        self.run_btn.config(text="시작 (F8)")
        self.status.config(text="정지됨")

    def tick(self):
        if not self.running:
            return
        now = time.monotonic()
        for p in self.points:
            if now >= p["next"]:
                click(p["x"], p["y"])
                p["next"] = now + p["interval"]
        self.root.after(10, self.tick)

    def poll_hotkey(self):
        down = bool(user32.GetAsyncKeyState(HOTKEY_VK) & 0x8000)
        if down and not self.hotkey_down:
            self.toggle()
        self.hotkey_down = down
        self.root.after(30, self.poll_hotkey)


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
