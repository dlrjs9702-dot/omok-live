extends Node
# 게임센터용 수정 (2026-10-19, 사용자 허락 「파일 수정은 괜찮고 원작자가 누군지 라이선스만 잘 남겨 놓으면 돼」) — 원작: 스마트대디.
# 원본 빌드는 그대로 두고 이 스크립트 하나를 autoload로 더했다(tools/herosurv/repack.js, public/herosurv/NOTICE.md).
# 게임센터는 닉네임·세션으로 랭킹을 올리고 참가 정보는 페이지(boot.js)가 미리 써 두므로, 게임 자체의 이름·메일 참가
# 흐름에 딸린 버튼·입력·안내 문구를 숨긴다. 「오픈소스 라이선스」·설정·강화 상점·내 전적·랭킹 보기·다시 전송은 그대로.

const HIDE_BUTTONS := ["이름 변경", "변경하기", "랭킹 참가", "랭킹에 올리기", "참가하기", "이름 정하고 랭킹 등록"]
const HIDE_LABEL_STARTS := ["랭킹 참가  ", "메일", "이벤트 보상 연락용", "로그인 없이 이름만", "이름만 정하면", "이름을 정하면", "[랭킹 참가]를 누르면"]
const HIDE_PLACEHOLDER_STARTS := ["메일", "예: "]

var _watch: Array = []


func _ready() -> void:
	get_tree().node_added.connect(_on_added)
	var t := Timer.new()
	t.wait_time = 0.3
	t.autostart = true
	t.timeout.connect(_tidy)
	add_child(t)


func _on_added(n: Node) -> void:
	if n is Button or n is Label or n is LineEdit or n is RichTextLabel or n.name == "RankBoard":
		_watch.append(n)
		_check.call_deferred(n)


# the ranking board draws its own hint (「[랭킹 참가]를 누르면…」) from a text the game hands it: that text, emptied
func _board(c) -> void:
	var changed := false
	for p in c.get_property_list():
		if p.type != TYPE_STRING or not (p.usage & PROPERTY_USAGE_SCRIPT_VARIABLE):
			continue
		var v := str(c.get(p.name))
		if v != "" and _starts(v, HIDE_LABEL_STARTS):
			c.set(p.name, "")
			changed = true
	if changed and c is CanvasItem:
		c.queue_redraw()


# (texts change after a node is made -- a label filled with the player's name later: looked at again a few times a second)
func _tidy() -> void:
	var keep: Array = []
	for c in _watch:
		if is_instance_valid(c):
			keep.append(c)
			_check(c)
	_watch = keep


func _starts(t: String, list: Array) -> bool:
	for p in list:
		if t.begins_with(p):
			return true
	return false


func _check(c) -> void:
	if not is_instance_valid(c) or not c.visible:
		return
	if c.name == "RankBoard":
		_board(c)
	if c is LineEdit:
		if _starts(str(c.placeholder_text), HIDE_PLACEHOLDER_STARTS):
			c.visible = false
		return
	var t := str(c.get("text")).strip_edges()
	if c is Button:
		if HIDE_BUTTONS.has(t):
			c.visible = false
	elif _starts(t, HIDE_LABEL_STARTS):
		c.visible = false
