; Pulse — фирменный установщик (NSIS, свой интерфейс без MUI).
; Графика: build/installer-ui (design.html → gen.js → crop.py), отдельные картинки для 100–200 % DPI.
; Собирается build/make-setup.sh
Unicode true
ManifestDPIAware true
XPStyle on
!define APP "Pulse"
!ifndef VERSION
  !define VERSION "1.0.1"
!endif
!define EXE "Pulse.exe"
!ifndef APPDIR
  !define APPDIR "..\dist\win-unpacked"
!endif
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.scada.pulse"
!define BG 0e0d12
Name "${APP}"
Caption "Pulse ${VERSION} Setup"
UninstallCaption "Uninstall Pulse"
!ifndef OUTFILE
  !define OUTFILE "..\dist\Pulse-Setup-${VERSION}.exe"
!endif
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Pulse"
InstallDirRegKey HKCU "Software\Pulse" "InstallDir"
RequestExecutionLevel user
; 1.0.0: без /SOLID — графика интерфейса распаковывается сразу, а не после всех предыдущих файлов сплошного архива
; (на 150–200 % масштабе окно раньше «висело» несколько секунд, пока LZMA проходил сотни МБ картинок других масштабов)
SetCompressor lzma
SetCompressorDictSize 64
Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText " "
ShowInstDetails nevershow
ShowUninstDetails nevershow
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "Pulse"
VIAddVersionKey /LANG=1033 "FileDescription" "Pulse Installer"
VIAddVersionKey /LANG=1033 "CompanyName" "werxapee, Daswi"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "werxapee, Daswi"
LoadLanguageFile "${NSISDIR}\Contrib\Language files\English.nlf"

!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!include "installer-ui\out\layout.nsh"

Page custom WelcomeShow WelcomeLeave
Page instfiles "" InstShow
Page custom FinishShow
UninstPage custom un.ConfirmShow
UninstPage instfiles "" un.InstShow
UninstPage custom un.DoneShow

Var S          ; масштаб интерфейса, % (100/125/150/175/200)
Var CW
Var CH
Var Dlg
Var Edit
Var SetupMutex
Var InstallPath
Var InstallPathPart
Var InstallPathLength
Var InstallProbe
Var InstallProbeHandle
Var FontEdit
Var FontSm
Var Upgrade
Var Tg1        ; ярлык на рабочем столе / удалить данные
Var Tg2        ; ярлык в «Пуск» / удалить скачанное
;#1.0.0: 4 «слота» интерактивных картинок. Картинки грузятся из $PLUGINSDIR\ui по имени кадра:
;   кнопка (K=0):        <имя>-h0..h4 — плавное наведение (HP растёт/падает на 1 за тик), <имя>-p — нажата
;   переключатель (K=1): <имя>-off/-offh/-on/-onh, при щелчке ползунок «едет» по кадрам <имя>-k1..k3 (AN — сколько кадров осталось)
!macro SLOTVARS N
  Var C${N}
  Var NM${N}
  Var K${N}
  Var ST${N}
  Var HV${N}
  Var HP${N}
  Var PR${N}
  Var AN${N}
  Var CUR${N}
!macroend
!insertmacro SLOTVARS 1
!insertmacro SLOTVARS 2
!insertmacro SLOTVARS 3
!insertmacro SLOTVARS 4
Var BgImg
; 1.0.0: анимации страницы — эквалайзер в шапке (W*) и логотип с бликом / значком «готово» (L*)
Var W        ; контрол эквалайзера (0 — нет)
Var WP       ; префикс кадров, напр. wel_wave
Var WF       ; кадр 0..11
Var WT       ; счётчик тиков
Var WCUR
Var WC       ; 1.0.0: кэш кадров эквалайзера — 24 готовые картинки в памяти (раньше каждый кадр читался с диска 12 раз в секунду)
Var HY       ; нижняя граница шапки (px окна) — курсор выше неё делает эквалайзер «громче»
Var L        ; контрол логотипа
Var LP
Var LF       ; кадр блика (0 — нет блика)
Var LB       ; кадр появления значка (-1 — не идёт)
Var LI       ; тиков до следующего блика
Var LO       ; 1 — курсор был вне логотипа
Var LX1
Var LY1
Var LX2
Var LY2
Var LCUR
Var FA       ; прозрачность окна при появлении (255 — готово)

; ---------- масштабирование прямоугольника "x y w h" (px при 100 %) → $R1..$R4 ----------
!macro SC4 X Y W H
  IntOp $R1 ${X} * $S
  IntOp $R1 $R1 / 100
  IntOp $R2 ${Y} * $S
  IntOp $R2 $R2 / 100
  IntOp $R3 ${X} + ${W}
  IntOp $R3 $R3 * $S
  IntOp $R3 $R3 / 100
  IntOp $R3 $R3 - $R1
  IntOp $R4 ${Y} + ${H}
  IntOp $R4 $R4 * $S
  IntOp $R4 $R4 / 100
  IntOp $R4 $R4 - $R2
!macroend

!macro LOADBMP OUT NAME
  System::Call 'user32::LoadImage(p0, t "$PLUGINSDIR\ui\${NAME}.bmp", i0, i0, i0, i0x10)p.s'
  Pop ${OUT}
!macroend

; ставит картинку кадра NAME в статик CTRL и удаляет прежнюю (портит $7, $8)
!macro SETBMP CTRL NAME
  System::Call 'user32::LoadImage(p0, t "$PLUGINSDIR\ui\${NAME}.bmp", i0, i0, i0, i0x10)p.r8'
  SendMessage ${CTRL} ${STM_SETIMAGE} ${IMAGE_BITMAP} $8 $7
  ${If} $7 != 0
    System::Call 'gdi32::DeleteObject(p r7)'
  ${EndIf}
!macroend

; 1.0.0: кадр эквалайзера из кэша (картинка не удаляется — ею владеет кэш; портит $7, $8)
!macro WSET IDX
  IntOp $7 ${IDX} * 8
  IntOp $7 $WC + $7
  System::Call '*$7(p .r8)'
  SendMessage $W ${STM_SETIMAGE} ${IMAGE_BITMAP} $8
!macroend

; удаляет картинку, стоящую в статике CTRL
!macro DROPBMP CTRL
  ${If} ${CTRL} != 0
    SendMessage ${CTRL} 0x173 ${IMAGE_BITMAP} 0 $7
    ${If} $7 != 0
      System::Call 'gdi32::DeleteObject(p r7)'
    ${EndIf}
  ${EndIf}
!macroend

; слот: N, вид (0 кнопка / 1 переключатель), имя, x y w h
!macro SLOT N KIND NAME X Y W H
  !insertmacro SC4 ${X} ${Y} ${W} ${H}
  nsDialogs::CreateControl STATIC ${WS_CHILD}|${WS_VISIBLE}|${WS_CLIPSIBLINGS}|${SS_BITMAP}|${SS_NOTIFY} 0 $R1 $R2 $R3 $R4 ""
  Pop $C${N}
  StrCpy $NM${N} "${NAME}"
  StrCpy $K${N} ${KIND}
  StrCpy $HV${N} 0
  StrCpy $HP${N} 0
  StrCpy $PR${N} 0
  StrCpy $AN${N} 0
  StrCpy $CUR${N} ""
  !insertmacro PAINT ${N}
!macroend

!macro PAINT N
  ${If} $K${N} == 0
    ${If} $PR${N} == 1
      StrCpy $6 "$NM${N}-p"
    ${Else}
      StrCpy $6 "$NM${N}-h$HP${N}"
    ${EndIf}
  ${ElseIf} $AN${N} > 0
    ${If} $ST${N} == 1
      IntOp $5 4 - $AN${N}
    ${Else}
      StrCpy $5 $AN${N}
    ${EndIf}
    StrCpy $6 "$NM${N}-k$5"
  ${ElseIf} $ST${N} == 1
    ${If} $HV${N} == 1
      StrCpy $6 "$NM${N}-onh"
    ${Else}
      StrCpy $6 "$NM${N}-on"
    ${EndIf}
  ${Else}
    ${If} $HV${N} == 1
      StrCpy $6 "$NM${N}-offh"
    ${Else}
      StrCpy $6 "$NM${N}-off"
    ${EndIf}
  ${EndIf}
  ${If} $6 != $CUR${N}
    StrCpy $CUR${N} $6
    !insertmacro SETBMP $C${N} $6
  ${EndIf}
!macroend

; переключить переключатель N с анимацией ползунка
!macro FLIP N
  IntOp $ST${N} 1 - $ST${N}
  StrCpy $AN${N} 3
  !insertmacro PAINT ${N}
!macroend

; тик слота: $0 — окно под курсором, $4 — зажата левая кнопка мыши
!macro HOVER N
  ${If} $C${N} != 0
    ${If} $0 == $C${N}
      StrCpy $HV${N} 1
    ${Else}
      StrCpy $HV${N} 0
    ${EndIf}
    ${If} $K${N} == 0
      StrCpy $PR${N} 0
      ${If} $HV${N} == 1
        ${If} $4 != 0
          StrCpy $PR${N} 1
        ${EndIf}
        ${If} $HP${N} < 4
          IntOp $HP${N} $HP${N} + 1
        ${EndIf}
      ${ElseIf} $HP${N} > 0
        IntOp $HP${N} $HP${N} - 1
      ${EndIf}
    ${ElseIf} $AN${N} > 0
      IntOp $AN${N} $AN${N} - 1
    ${EndIf}
    !insertmacro PAINT ${N}
  ${EndIf}
!macroend

!macro FREESLOT N
  !insertmacro DROPBMP $C${N}
  StrCpy $C${N} 0
  StrCpy $ST${N} 0
!macroend

; ---------- общий код установщика и деинсталлятора ----------
!macro COMMON UN
Function ${UN}FreeSlots
  !insertmacro FREESLOT 1
  !insertmacro FREESLOT 2
  !insertmacro FREESLOT 3
  !insertmacro FREESLOT 4
  ${If} $WC != 0
  ${AndIf} $WC != ""
    ${If} $W != 0
      SendMessage $W ${STM_SETIMAGE} ${IMAGE_BITMAP} 0
    ${EndIf}
    StrCpy $5 0
    ${Do}
      IntOp $7 $5 * 8
      IntOp $7 $WC + $7
      System::Call '*$7(p .r8)'
      System::Call 'gdi32::DeleteObject(p r8)'
      IntOp $5 $5 + 1
    ${LoopUntil} $5 >= 24
    System::Free $WC
    StrCpy $WC 0
  ${EndIf}
  !insertmacro DROPBMP $W
  !insertmacro DROPBMP $L
  StrCpy $W 0
  StrCpy $L 0
  ${If} $BgImg != 0
    System::Call 'gdi32::DeleteObject(p $BgImg)'
  ${EndIf}
  StrCpy $BgImg 0
FunctionEnd

; окно: тёмный заголовок, размер под DPI, по центру, без стандартных кнопок
Function ${UN}SetupWindow
  System::Call 'user32::GetDC(p0)p.r0'
  System::Call 'gdi32::GetDeviceCaps(p r0, i 88)i.r1'
  System::Call 'user32::ReleaseDC(p0, p r0)'
  ${If} $1 <= 108
    StrCpy $S 100
  ${ElseIf} $1 <= 132
    StrCpy $S 125
  ${ElseIf} $1 <= 156
    StrCpy $S 150
  ${ElseIf} $1 <= 180
    StrCpy $S 175
  ${Else}
    StrCpy $S 200
  ${EndIf}
  IntOp $CW 680 * $S
  IntOp $CW $CW / 100
  IntOp $CH 440 * $S
  IntOp $CH $CH / 100
  ; прячем всё стандартное; кнопки «Далее/Отмена/Назад» уводим за край (Enter/Esc продолжают работать)
  System::Call 'user32::GetWindow(p $HWNDPARENT, i 5)p.r1'
  ${DoWhile} $1 != 0
    System::Call 'user32::GetDlgCtrlID(p r1)i.r2'
    ${If} $2 == 1
    ${OrIf} $2 == 2
    ${OrIf} $2 == 3
      System::Call 'user32::SetWindowPos(p r1, p0, i -3000, i -3000, i 0, i 0, i 0x15)'
    ${Else}
      ShowWindow $1 ${SW_HIDE}
    ${EndIf}
    System::Call 'user32::GetWindow(p r1, i 2)p.r1'
  ${Loop}
  SetCtlColors $HWNDPARENT "" ${BG}
  ; размер клиентской области ровно CW×CH, окно по центру рабочей области
  System::Call '*(i,i,i,i)p.r9'
  System::Call 'user32::GetWindowRect(p $HWNDPARENT, p r9)'
  System::Call '*$9(i.r1,i.r2,i.r3,i.r4)'
  IntOp $5 $3 - $1
  IntOp $6 $4 - $2
  System::Call 'user32::GetClientRect(p $HWNDPARENT, p r9)'
  System::Call '*$9(i,i,i.r3,i.r4)'
  IntOp $5 $5 - $3
  IntOp $5 $5 + $CW
  IntOp $6 $6 - $4
  IntOp $6 $6 + $CH
  System::Call 'user32::SystemParametersInfo(i 0x30, i 0, p r9, i 0)'
  System::Call '*$9(i.r1,i.r2,i.r3,i.r4)'
  IntOp $7 $3 - $1
  IntOp $7 $7 - $5
  IntOp $7 $7 / 2
  IntOp $7 $7 + $1
  IntOp $8 $4 - $2
  IntOp $8 $8 - $6
  IntOp $8 $8 / 2
  IntOp $8 $8 + $2
  System::Free $9
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p0, i r7, i r8, i r5, i r6, i 0x14)'
  ; Windows 10/11: тёмный заголовок окна в цвет фона
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 19, *i 1, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 35, *i 0x00120D0E, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 36, *i 0x00F7F2F4, i 4)'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 34, *i 0x0033292A, i 4)'
  CreateFont $FontEdit "Segoe UI" 10 400
  CreateFont $FontSm "Segoe UI" 9 400
  StrCpy $C1 0
  StrCpy $C2 0
  StrCpy $C3 0
  StrCpy $C4 0
  StrCpy $W 0
  StrCpy $WC 0
  StrCpy $L 0
  StrCpy $BgImg 0
  ; 1.0.0: окно плавно проявляется (прозрачность растёт в таймере страницы)
  System::Call 'user32::GetWindowLong(p $HWNDPARENT, i -20)i.r1'
  IntOp $1 $1 | 0x80000
  System::Call 'user32::SetWindowLong(p $HWNDPARENT, i -20, i r1)'
  System::Call 'user32::SetLayeredWindowAttributes(p $HWNDPARENT, i 0, i 0, i 2)'
  StrCpy $FA 0
FunctionEnd

; 1.0.0: окно полностью видно, слой прозрачности снят
Function ${UN}FadeDone
  ${If} $FA != 255
    StrCpy $FA 255
    System::Call 'user32::SetLayeredWindowAttributes(p $HWNDPARENT, i 0, i 255, i 2)'
    System::Call 'user32::GetWindowLong(p $HWNDPARENT, i -20)i.r1'
    IntOp $1 $1 & 0xFFF7FFFF
    System::Call 'user32::SetWindowLong(p $HWNDPARENT, i -20, i r1)'
    System::Call 'user32::RedrawWindow(p $HWNDPARENT, p0, p0, i 0x485)'
  ${EndIf}
FunctionEnd

; 1.0.0: шапка с эквалайзером и логотипом (страницы приветствия/обновления/удаления). Стек: префикс эквалайзера, префикс логотипа
Function ${UN}AnimHead
  Pop $LP
  Pop $WP
  !insertmacro SC4 ${wel_wave}
  nsDialogs::CreateControl STATIC ${WS_CHILD}|${WS_VISIBLE}|${WS_CLIPSIBLINGS}|${SS_BITMAP} 0 $R1 $R2 $R3 $R4 ""
  Pop $W
  StrCpy $WF 0
  StrCpy $WT 0
  StrCpy $WCUR 0
  System::Alloc 192
  Pop $WC
  StrCpy $5 0
  ${Do}
    System::Call 'user32::LoadImage(p0, t "$PLUGINSDIR\ui\$WP-c$5.bmp", i0, i0, i0, i0x10)p.r6'
    IntOp $7 $5 * 8
    IntOp $7 $WC + $7
    System::Call '*$7(p r6)'
    System::Call 'user32::LoadImage(p0, t "$PLUGINSDIR\ui\$WP-x$5.bmp", i0, i0, i0, i0x10)p.r6'
    IntOp $7 $5 + 12
    IntOp $7 $7 * 8
    IntOp $7 $WC + $7
    System::Call '*$7(p r6)'
    IntOp $5 $5 + 1
  ${LoopUntil} $5 >= 12
  !insertmacro WSET 0
  IntOp $HY 252 * $S
  IntOp $HY $HY / 100
  !insertmacro SC4 ${wel_logo}
  Push 40
  Push -1
  Call ${UN}MakeLogo
FunctionEnd

; 1.0.0: логотип на финальной странице. Стек: префикс, кадр значка «готово» (0 — проиграть появление, -1 — нет)
Function ${UN}AnimFin
  Pop $0
  Pop $LP
  StrCpy $W 0
  !insertmacro SC4 ${fin_logo}
  Push 1
  Push $0
  Call ${UN}MakeLogo
FunctionEnd

; $R1..$R4 — прямоугольник; стек: LB, затем LI
Function ${UN}MakeLogo
  Pop $LB
  Pop $LI
  nsDialogs::CreateControl STATIC ${WS_CHILD}|${WS_VISIBLE}|${WS_CLIPSIBLINGS}|${SS_BITMAP} 0 $R1 $R2 $R3 $R4 ""
  Pop $L
  StrCpy $LF 0
  StrCpy $LO 1
  StrCpy $LX1 $R1
  StrCpy $LY1 $R2
  IntOp $LX2 $R1 + $R3
  IntOp $LY2 $R2 + $R4
  ${If} $LB >= 0
    StrCpy $LCUR "$LP-b0"
  ${Else}
    StrCpy $LCUR "$LP-s0"
  ${EndIf}
  !insertmacro SETBMP $L $LCUR
FunctionEnd

; новая страница nsDialogs на всё окно
Function ${UN}NewPage
  Call ${UN}FreeSlots
  nsDialogs::Create 1018
  Pop $Dlg
  System::Call 'user32::SetWindowPos(p $Dlg, p0, i 0, i 0, i $CW, i $CH, i 0x14)'
  SetCtlColors $Dlg "" ${BG}
FunctionEnd

; фон страницы — самым нижним слоем, без SS_NOTIFY (обычная стрелка курсора)
Function ${UN}PageBg
  Pop $0
  nsDialogs::CreateControl STATIC ${WS_CHILD}|${WS_VISIBLE}|${WS_CLIPSIBLINGS}|${SS_BITMAP} 0 0 0 $CW $CH ""
  Pop $1
  !insertmacro LOADBMP $BgImg "$0"
  SendMessage $1 ${STM_SETIMAGE} ${IMAGE_BITMAP} $BgImg
  System::Call 'user32::SetWindowPos(p r1, p 1, i0, i0, i0, i0, i 0x13)'
  ; «рука» над кнопками и переключателями
  ${If} $C1 != 0
    System::Call 'user32::LoadCursor(p0, i 32649)p.r2'
    System::Call 'user32::SetClassLong(p $C1, i -12, p r2)'
  ${EndIf}
FunctionEnd

; 1.0.0: один таймер (40 мс) на всё: наведение/нажатие, ход переключателей, эквалайзер, блик, проявление окна
Function ${UN}HoverTick
  ; nsDialogs timers can re-enter a folder picker/SendMessage. Never corrupt caller registers.
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9
  System::Call '*(i,i)p.r9'
  System::Call 'user32::GetCursorPos(p r9)'
  System::Call '*$9(i.r2,i.r3)'
  System::Call 'user32::WindowFromPoint(i r2, i r3)p.r0'
  System::Call 'user32::ScreenToClient(p $Dlg, p r9)'
  System::Call '*$9(i.r2,i.r3)'
  System::Free $9
  System::Call 'user32::GetAsyncKeyState(i 1)i.r4'
  IntOp $4 $4 & 0x8000
  !insertmacro HOVER 1
  !insertmacro HOVER 2
  !insertmacro HOVER 3
  !insertmacro HOVER 4
  ; проявление окна
  ${If} $FA < 255
    IntOp $FA $FA + 36
    ${If} $FA >= 255
      StrCpy $FA 0
      Call ${UN}FadeDone
    ${Else}
      System::Call 'user32::SetLayeredWindowAttributes(p $HWNDPARENT, i 0, i $FA, i 2)'
    ${EndIf}
  ${EndIf}
  ; эквалайзер: курсор над шапкой — играет быстрее и «громче»
  ${If} $W != 0
    StrCpy $5 0
    ${If} $2 >= 0
    ${AndIf} $2 < $CW
    ${AndIf} $3 >= 0
    ${AndIf} $3 < $HY
      StrCpy $5 1
    ${EndIf}
    IntOp $WT $WT + 1
    ${If} $5 == 1
    ${OrIf} $WT >= 2
      StrCpy $WT 0
      IntOp $WF $WF + 1
      ${If} $WF >= 12
        StrCpy $WF 0
      ${EndIf}
    ${EndIf}
    ${If} $5 == 1
      IntOp $6 $WF + 12
    ${Else}
      StrCpy $6 $WF
    ${EndIf}
    ${If} $6 != $WCUR
      StrCpy $WCUR $6
      !insertmacro WSET $6
    ${EndIf}
  ${EndIf}
  ; логотип: значок «готово» выпрыгивает, блик пробегает раз в ~4 с и при наведении курсора
  ${If} $L != 0
    StrCpy $1 0
    ${If} $2 >= $LX1
    ${AndIf} $2 < $LX2
    ${AndIf} $3 >= $LY1
    ${AndIf} $3 < $LY2
      StrCpy $1 1
    ${EndIf}
    ${If} $LB >= 0
      StrCpy $6 "$LP-b$LB"
      IntOp $LB $LB + 1
      ${If} $LB > 7
        StrCpy $LB -1
        StrCpy $LF 1
      ${EndIf}
    ${ElseIf} $LF > 0
      StrCpy $6 "$LP-s$LF"
      IntOp $LF $LF + 1
      ${If} $LF > 7
        StrCpy $LF 0
        StrCpy $LI 100
      ${EndIf}
    ${Else}
      StrCpy $6 "$LP-s0"
      IntOp $LI $LI - 1
      ${If} $LI <= 0
        StrCpy $LF 1
      ${ElseIf} $1 == 1
      ${AndIf} $LO == 1
        StrCpy $LF 1
      ${EndIf}
    ${EndIf}
    IntOp $LO 1 - $1
    ${If} $6 != $LCUR
      StrCpy $LCUR $6
      !insertmacro SETBMP $L $6
    ${EndIf}
  ${EndIf}
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
  Pop $9
  Pop $8
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0

FunctionEnd

Function ${UN}StartHover
  GetFunctionAddress $0 ${UN}HoverTick
  nsDialogs::CreateTimer $0 40
FunctionEnd

Function ${UN}StopHover
  GetFunctionAddress $0 ${UN}HoverTick
  nsDialogs::KillTimer $0
FunctionEnd

Function ${UN}Next
  Call ${UN}StopHover
  Call ${UN}FadeDone
  SendMessage $HWNDPARENT 0x408 1 0
FunctionEnd

; страница прогресса: прячем список, перекрашиваем полосу, ставим фон
Function ${UN}StyleInstFiles
  Pop $0
  Call ${UN}FadeDone
  Call ${UN}FreeSlots
  FindWindow $Dlg "#32770" "" $HWNDPARENT
  System::Call 'user32::SetWindowPos(p $Dlg, p0, i 0, i 0, i $CW, i $CH, i 0x14)'
  SetCtlColors $Dlg "" ${BG}
  ; оставляем только полосу (1004) и строку статуса (1006)
  System::Call 'user32::GetWindow(p $Dlg, i 5)p.r1'
  ${DoWhile} $1 != 0
    System::Call 'user32::GetDlgCtrlID(p r1)i.r2'
    ${If} $2 != 1004
    ${AndIf} $2 != 1006
      ShowWindow $1 ${SW_HIDE}
    ${EndIf}
    System::Call 'user32::GetWindow(p r1, i 2)p.r1'
  ${Loop}
  !insertmacro SC4 ${prog_bar}
  GetDlgItem $1 $Dlg 1004
  System::Call 'uxtheme::SetWindowTheme(p r1, w " ", w " ")'
  System::Call 'user32::GetWindowLong(p r1, i -16)i.r2'
  IntOp $2 $2 & 0xFF7FFFFF
  IntOp $2 $2 | 0x04000001
  System::Call 'user32::SetWindowLong(p r1, i -16, i r2)'
  System::Call 'user32::SetWindowLong(p r1, i -20, i 0)'
  System::Call 'user32::SetWindowPos(p r1, p0, i $R1, i $R2, i $R3, i $R4, i 0x34)'
  SendMessage $1 0x409 0 0x006F44F0
  SendMessage $1 0x2001 0 0x002C2324
  ; строка статуса под полосой, по центру
  IntOp $R2 $R2 + $R4
  IntOp $5 14 * $S
  IntOp $5 $5 / 100
  IntOp $R2 $R2 + $5
  IntOp $R4 22 * $S
  IntOp $R4 $R4 / 100
  GetDlgItem $1 $Dlg 1006
  System::Call 'user32::GetWindowLong(p r1, i -16)i.r2'
  IntOp $2 $2 & 0xFFFFFFE0
  IntOp $2 $2 | 0x04000081
  System::Call 'user32::SetWindowLong(p r1, i -16, i r2)'
  System::Call 'user32::SetWindowPos(p r1, p0, i $R1, i $R2, i $R3, i $R4, i 0x34)'
  SendMessage $1 ${WM_SETFONT} $FontSm 1
  SetCtlColors $1 8f8b9b ${BG}
  ; фон
  !insertmacro LOADBMP $BgImg "$0"
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i 0x5400000E, i 0, i 0, i $CW, i $CH, p $Dlg, p 0, p 0, p 0)p.r1'
  SendMessage $1 ${STM_SETIMAGE} ${IMAGE_BITMAP} $BgImg
  System::Call 'user32::SetWindowPos(p r1, p 1, i0, i0, i0, i0, i 0x13)'
  SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:$(^Name) ${VERSION}"
FunctionEnd

!macroend
!insertmacro COMMON ""
!insertmacro COMMON "un."

; ---------- установщик ----------
Function AcquireSetupMutex
  System::Call 'kernel32::CreateMutex(p0, i0, t "PulseSetupMutex")p.r0 ?e'
  StrCpy $SetupMutex $0
  Pop $0
  ${If} $0 == 183
    MessageBox MB_ICONINFORMATION "Pulse Setup is already running."
    Abort
  ${EndIf}
FunctionEnd

Function .onGUIEnd
  ${If} $SetupMutex != 0
    System::Call 'kernel32::CloseHandle(p $SetupMutex)'
    StrCpy $SetupMutex 0
  ${EndIf}
FunctionEnd

Function .onInit
  Call AcquireSetupMutex
  StrCpy $Upgrade 0
  StrCpy $Tg1 1
  StrCpy $Tg2 1
  ${If} ${FileExists} "$INSTDIR\${EXE}"
    StrCpy $Upgrade 1
    ; при обновлении сохраняем выбор, сделанный в прошлый раз
    ${IfNot} ${FileExists} "$DESKTOP\Pulse.lnk"
      StrCpy $Tg1 0
    ${EndIf}
    ${IfNot} ${FileExists} "$SMPROGRAMS\Pulse.lnk"
      StrCpy $Tg2 0
    ${EndIf}
  ${EndIf}
FunctionEnd

!macro EXTRACT_INST SC
  File "installer-ui\out\${SC}\wel_*.bmp"
  File "installer-ui\out\${SC}\upd_*.bmp"
  File "installer-ui\out\${SC}\prog_*.bmp"
  File "installer-ui\out\${SC}\fin_*.bmp"
!macroend
Function .onGUIInit
  Call SetupWindow
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\ui"
  ${If} $S == 100
    !insertmacro EXTRACT_INST 100
  ${ElseIf} $S == 125
    !insertmacro EXTRACT_INST 125
  ${ElseIf} $S == 150
    !insertmacro EXTRACT_INST 150
  ${ElseIf} $S == 175
    !insertmacro EXTRACT_INST 175
  ${Else}
    !insertmacro EXTRACT_INST 200
  ${EndIf}
  SetOutPath "$TEMP"
FunctionEnd

Function WelcomeShow
  Call NewPage
  SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Pulse ${VERSION} Setup"
  ${If} $Upgrade == 1
    !insertmacro SLOT 1 0 upd_go ${wel_go}
  ${Else}
    !insertmacro SLOT 1 0 wel_go ${wel_go}
  ${EndIf}
  !insertmacro SLOT 2 0 wel_browse ${wel_browse}
  StrCpy $ST3 $Tg1
  !insertmacro SLOT 3 1 wel_t1 ${wel_t1}
  StrCpy $ST4 $Tg2
  !insertmacro SLOT 4 1 wel_t2 ${wel_t2}
  ${NSD_OnClick} $C1 WelClick
  ${NSD_OnClick} $C2 WelClick
  ${NSD_OnClick} $C3 WelClick
  ${NSD_OnClick} $C4 WelClick
  ; поле пути (без рамки — рамку рисует фон)
  !insertmacro SC4 ${wel_field}
  IntOp $5 14 * $S
  IntOp $5 $5 / 100
  IntOp $R1 $R1 + $5
  IntOp $R3 $R3 - $5
  IntOp $R3 $R3 - $5
  IntOp $5 10 * $S
  IntOp $5 $5 / 100
  IntOp $R2 $R2 + $5
  IntOp $R4 $R4 - $5
  IntOp $R4 $R4 - $5
  nsDialogs::CreateControl EDIT ${WS_CHILD}|${WS_VISIBLE}|${WS_TABSTOP}|${WS_CLIPSIBLINGS}|${ES_AUTOHSCROLL} 0 $R1 $R2 $R3 $R4 "$INSTDIR"
  Pop $Edit
  SendMessage $Edit ${WM_SETFONT} $FontEdit 1
  SetCtlColors $Edit f4f2f7 1b1a22
  ${If} $Upgrade == 1
    Push upd_wave
    Push upd_logo
  ${Else}
    Push wel_wave
    Push wel_logo
  ${EndIf}
  Call AnimHead
  ${If} $Upgrade == 1
    Push upd_bg
  ${Else}
    Push wel_bg
  ${EndIf}
  Call PageBg
  Call StartHover
  nsDialogs::Show
FunctionEnd

Function WelClick
  Pop $0
  ${If} $0 == $C1
    Call Next
  ${ElseIf} $0 == $C2
    ${NSD_GetText} $Edit $1
    nsDialogs::SelectFolderDialog "Choose a folder to install Pulse" "$1"
    Pop $1
    ${If} $1 != error
    ${AndIf} $1 != ""
      StrCpy $2 $1 6 -6
      ${If} $2 != "\Pulse"
        StrCpy $2 $1 1 -1
        ${If} $2 == "\"
          StrCpy $1 "$1Pulse"
        ${Else}
          StrCpy $1 "$1\Pulse"
        ${EndIf}
      ${EndIf}
      ${NSD_SetText} $Edit $1
    ${EndIf}
  ${ElseIf} $0 == $C3
    !insertmacro FLIP 3
  ${ElseIf} $0 == $C4
    !insertmacro FLIP 4
  ${EndIf}
FunctionEnd

Function WelcomeLeave
  ; Stop animation before reading/validating, including keyboard-driven page changes.
  Call StopHover
  ${NSD_GetText} $Edit $InstallPath
  Call ValidateInstallPath
  ${If} $InstallPathPart != ""
    MessageBox MB_ICONEXCLAMATION "$InstallPathPart"
    Call StartHover
    Abort
  ${EndIf}
  ; Test actual permissions, not just the drive letter. Never reuse/delete a fixed-name file.
  ClearErrors
  CreateDirectory "$InstallPath"
  IfErrors install_path_denied
  GetTempFileName $InstallProbe "$InstallPath"
  IfErrors install_path_denied
  ClearErrors
  FileOpen $InstallProbeHandle "$InstallProbe" w
  IfErrors install_probe_denied
  FileWrite $InstallProbeHandle "Pulse installer write check"
  FileClose $InstallProbeHandle
  IfErrors install_probe_denied
  Delete "$InstallProbe"
  StrCpy $INSTDIR $InstallPath
  StrCpy $Tg1 $ST3
  StrCpy $Tg2 $ST4
  Return
install_probe_denied:
  Delete "$InstallProbe"
install_path_denied:
  ; User-level installs stay user-level. Elevate only after explicit consent when needed.
  System::Call 'shell32::IsUserAnAdmin() i.r0'
  ${If} $0 == 0
    MessageBox MB_ICONQUESTION|MB_YESNO "Cannot write to:$\r$\n$InstallPath$\r$\n$\r$\nProgram Files usually requires administrator permission. Restart Setup and request permission?$\r$\n$\r$\nWithout elevation, choose $LOCALAPPDATA\Programs\Pulse or another writable folder." IDNO install_path_retry
    ; Hand over the single-instance lock before the elevated child starts.
    System::Call 'kernel32::CloseHandle(p $SetupMutex)'
    StrCpy $SetupMutex 0
    ClearErrors
    ExecShell "runas" "$EXEPATH" '/D=$InstallPath'
    IfErrors install_elevation_cancelled
    Quit
install_elevation_cancelled:
    Call AcquireSetupMutex
    Goto install_path_retry
  ${EndIf}
  MessageBox MB_ICONEXCLAMATION "Could not write files to:$\r$\n$InstallPath$\r$\nCheck folder permissions, the drive and available space. You can choose another folder."
install_path_retry:
  Call StartHover
  Abort
FunctionEnd

; Separate deterministic path validation from UI, timers and permission checks.
; Only dedicated variables are used; nsDialogs callbacks cannot overwrite the path/length.
!include "install-path.nsh"
!include "update-shutdown.nsh"

Function InstShow
  Push prog_bg
  Call StyleInstFiles
FunctionEnd

Section "Pulse" SecMain
  SectionIn RO
  SetDetailsPrint textonly
  DetailPrint "Closing Pulse if it is running…"
  SetDetailsPrint none
  ; UPDATE-SHUTDOWN-BEGIN: only signal EXISTING processes; NEVER launch the installed EXE.
  ; Old Pulse releases ignore --quit-for-update and would open (or block ExecWait).
  ; Try Windows close first, then terminate the process tree if it remains alive.
  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /IM "${EXE}" /T'
  Pop $0
  Pop $1
  Sleep 1500
  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /IM "${EXE}" /T /F'
  Pop $0
  Pop $1
  Sleep 1500
  ; UPDATE-SHUTDOWN-END
  !insertmacro PulseWaitForRelease install
  SetDetailsPrint textonly
  DetailPrint "Copying files…"
  SetDetailsPrint none
  !ifdef TESTSLOW
    Sleep 4000
  !endif
  ClearErrors
  SetOutPath "$INSTDIR"
  IfErrors install_copy_failed
  File /r "${APPDIR}\*.*"
  IfErrors install_copy_failed
  SetDetailsPrint textonly
  DetailPrint "Creating shortcuts…"
  SetDetailsPrint none
  WriteUninstaller "$INSTDIR\Uninstall Pulse.exe"
  ${If} $Tg2 == 1
    CreateShortCut "$SMPROGRAMS\Pulse.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  ${Else}
    Delete "$SMPROGRAMS\Pulse.lnk"
  ${EndIf}
  ${If} $Tg1 == 1
    CreateShortCut "$DESKTOP\Pulse.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  ${Else}
    Delete "$DESKTOP\Pulse.lnk"
  ${EndIf}
  WriteRegStr HKCU "Software\Pulse" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Pulse"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "werxapee, Daswi"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall Pulse.exe"'
  WriteRegStr HKCU "${UNKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall Pulse.exe" /S'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNKEY}" "EstimatedSize" "$0"
  SetDetailsPrint textonly
  DetailPrint "Done"
  SetAutoClose true
  Goto install_copy_done
install_copy_failed:
  SetErrorLevel 1
  MessageBox MB_ICONSTOP "Setup could not finish: failed to copy files to $INSTDIR. Check folder permissions and available space."
  Abort
install_copy_done:
SectionEnd

Function FinishShow
  Call NewPage
  SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Pulse ${VERSION} installed"
  !insertmacro SLOT 1 0 fin_run ${fin_run}
  !insertmacro SLOT 2 0 fin_close ${fin_close}
  ${NSD_OnClick} $C1 FinClick
  ${NSD_OnClick} $C2 FinClick
  Push fin_logo
  Push 0
  Call AnimFin
  Push fin_bg
  Call PageBg
  Call StartHover
  nsDialogs::Show
FunctionEnd

Function FinClick
  Pop $0
  ${If} $0 == $C1
    Exec '"$INSTDIR\${EXE}"'
  ${EndIf}
  Call Next
FunctionEnd

; ---------- деинсталлятор ----------
Function un.onInit
  StrCpy $Tg1 1
  StrCpy $Tg2 0
FunctionEnd

!macro EXTRACT_UN SC
  File "installer-ui\out\${SC}\ucf_*.bmp"
  File "installer-ui\out\${SC}\uprog_*.bmp"
  File "installer-ui\out\${SC}\udone_*.bmp"
!macroend
Function un.onGUIInit
  Call un.SetupWindow
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\ui"
  ${If} $S == 100
    !insertmacro EXTRACT_UN 100
  ${ElseIf} $S == 125
    !insertmacro EXTRACT_UN 125
  ${ElseIf} $S == 150
    !insertmacro EXTRACT_UN 150
  ${ElseIf} $S == 175
    !insertmacro EXTRACT_UN 175
  ${Else}
    !insertmacro EXTRACT_UN 200
  ${EndIf}
  SetOutPath "$TEMP"
FunctionEnd

Function un.ConfirmShow
  Call un.NewPage
  SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Uninstall Pulse"
  !insertmacro SLOT 1 0 ucf_go ${ucf_go}
  !insertmacro SLOT 2 0 ucf_cancel ${ucf_cancel}
  StrCpy $ST3 $Tg1
  !insertmacro SLOT 3 1 ucf_u1 ${ucf_u1}
  StrCpy $ST4 $Tg2
  !insertmacro SLOT 4 1 ucf_u2 ${ucf_u2}
  ${NSD_OnClick} $C1 un.CfClick
  ${NSD_OnClick} $C2 un.CfClick
  ${NSD_OnClick} $C3 un.CfClick
  ${NSD_OnClick} $C4 un.CfClick
  Push ucf_wave
  Push ucf_logo
  Call un.AnimHead
  Push ucf_bg
  Call un.PageBg
  Call un.StartHover
  nsDialogs::Show
FunctionEnd

Function un.CfClick
  Pop $0
  ${If} $0 == $C1
    StrCpy $Tg1 $ST3
    StrCpy $Tg2 $ST4
    Call un.Next
  ${ElseIf} $0 == $C2
    Call un.StopHover
    SendMessage $HWNDPARENT ${WM_COMMAND} 2 0
  ${ElseIf} $0 == $C3
    !insertmacro FLIP 3
  ${ElseIf} $0 == $C4
    !insertmacro FLIP 4
    ; скачанные треки лежат внутри папки данных — удалять их без данных бессмысленно
    ${If} $ST4 == 1
    ${AndIf} $ST3 == 0
      !insertmacro FLIP 3
    ${EndIf}
  ${EndIf}
FunctionEnd

Function un.InstShow
  Push uprog_bg
  Call un.StyleInstFiles
FunctionEnd

Section "un.Pulse" UnMain
  SetDetailsPrint textonly
  DetailPrint "Closing Pulse…"
  SetDetailsPrint none
  ; UPDATE-SHUTDOWN-BEGIN: only signal EXISTING processes; NEVER launch the installed EXE.
  ; Old Pulse releases ignore --quit-for-update and would open (or block ExecWait).
  ; Try Windows close first, then terminate the process tree if it remains alive.
  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /IM "${EXE}" /T'
  Pop $0
  Pop $1
  Sleep 1500
  nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /IM "${EXE}" /T /F'
  Pop $0
  Pop $1
  Sleep 1500
  ; UPDATE-SHUTDOWN-END
  !insertmacro PulseWaitForRelease uninstall
  SetDetailsPrint textonly
  DetailPrint "Removing files…"
  SetDetailsPrint none
  Delete "$SMPROGRAMS\Pulse.lnk"
  Delete "$DESKTOP\Pulse.lnk"
  ; 1.0.0: remove only package-owned files, never all contents of a chosen folder.
  !include "uninstall-files.nsh"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\Pulse"
  ; настройки, библиотека, вход и кэш (скачанные треки — только если отмечено)
  ${If} $Tg1 == 1
    SetDetailsPrint textonly
    DetailPrint "Removing settings and cache…"
    SetDetailsPrint none
    StrCpy $0 "$APPDATA\Pulse"
    Call un.WipeKeepOffline
    StrCpy $0 "$APPDATA\pulse-player"
    Call un.WipeKeepOffline
  ${EndIf}
  ${If} $Tg2 == 1
    RMDir /r "$APPDATA\Pulse\offline"
    RMDir /r "$APPDATA\pulse-player\offline"
    RMDir "$APPDATA\Pulse"
    RMDir "$APPDATA\pulse-player"
  ${EndIf}
  SetDetailsPrint textonly
  DetailPrint "Done"
  SetAutoClose true
SectionEnd

; удаляет всё в папке $0, кроме папки offline (скачанные треки)
Function un.WipeKeepOffline
  IfFileExists "$0\*.*" 0 wkDone
  FindFirst $1 $2 "$0\*.*"
  wkLoop:
    StrCmp $2 "" wkEnd
    StrCmp $2 "." wkNext
    StrCmp $2 ".." wkNext
    StrCmp $2 "offline" wkNext
    IfFileExists "$0\$2\*.*" 0 +3
      RMDir /r "$0\$2"
      Goto wkNext
    Delete "$0\$2"
  wkNext:
    FindNext $1 $2
    Goto wkLoop
  wkEnd:
  FindClose $1
  RMDir "$0"
  wkDone:
FunctionEnd

Function un.DoneShow
  Call un.NewPage
  SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Pulse removed"
  !insertmacro SLOT 1 0 udone_close ${udone_close}
  ${NSD_OnClick} $C1 un.DoneClick
  Push udone_logo
  Push -1
  Call un.AnimFin
  Push udone_bg
  Call un.PageBg
  Call un.StartHover
  nsDialogs::Show
FunctionEnd

Function un.DoneClick
  Pop $0
  Call un.Next
FunctionEnd
