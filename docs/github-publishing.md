# Публикация Pulse на GitHub

## 1. Что должно лежать в репозитории

Распакуйте **исходники**, а не portable EXE. В корне должны быть `package.json`, `README.md`, `LICENSE`, `NOTICE.md`, `.gitignore`, каталоги `renderer`, `native`, `build`, `tests` и `.github`.

Публикуйте только проверенную версию. Не загружайте профиль Electron, cookies, токены, `.env`, скачанную музыку, пользовательские плагины или конфиги. Отдельно проверьте локальные файлы и историю Git: `.gitignore` не удаляет секреты из прежних коммитов. Если секрет уже опубликован — отзовите/замените его, одного удаления файла недостаточно.

**Не коммитьте** `node_modules`, `dist`, `native/**/bin`, `native/**/obj`, собранный медиамост и тестовые скриншоты. В репозитории остаются исходники моста и инструкции сборки. `audit-evidence` — приложение к переданному архиву; для Git оно исключено.

Папка `resources/yt-dlp` содержит поставляемый сторонний компонент; сохраняйте его лицензии. Исходники и атрибуция Mineradio/других компонентов остаются на месте. Не заменяйте всю атрибуцию одной строкой с авторами Pulse.

## 2. Создайте пустой репозиторий

На GitHub: **New repository** → название `Pulse` или `pulse-player` → владелец (личный аккаунт/организация). Сначала можно выбрать Private, завершить проверку и затем сделать Public. Если README, LICENSE и `.gitignore` уже есть в проекте, при создании пустого репозитория не добавляйте их повторно.

В поле Description можно написать:

> An independent Windows music client with synchronized lyrics, GPU visualizers and offline listening.

Темы (Topics): `electron`, `music-player`, `windows`, `lyrics`, `visualizer`, `javascript`, `open-source`.

Не заявляйте официальную поддержку YouTube/Apple/Spotify, обход DRM или подтверждённую совместимость Windhawk, пока она не проверена.

## 3. Загрузите исходники через Git

В GitHub Desktop: **File → Add local repository** (либо создать репозиторий из этой папки), просмотрите Changed files, сделайте первый коммит, затем **Publish repository**. Проверьте флажок Private в соответствии с выбранной видимостью.

Альтернатива в терминале из папки проекта:

```sh
git init
git branch -M main
git status --short
git add .
git diff --cached --stat
git diff --cached
# Не продолжайте, если видите профиль, ключи, музыку или лишние бинарники.
git commit -m "Prepare Pulse 1.0.0 public release"
git remote add origin https://github.com/YOUR_ACCOUNT/Pulse.git
git push -u origin main
```

Замените `YOUR_ACCOUNT` и имя репозитория на свои. GitHub предложит поддерживаемый способ авторизации; пароль/токен не вписывайте в URL remote и не храните в файлах проекта.

## 4. Оформление

В README уже есть описание, ограничения сервисов, запуск, сборка, лицензия и авторы. Добавьте 2–3 собственных актуальных скриншота: главная, текст песни, визуализатор. Положите их в `docs/screenshots` и используйте относительные ссылки. До публикации уберите личную почту, имена аккаунтов и приватные плейлисты с изображений.

Авторы: **Bon_zeD** и **Daswi**. Если известны их реальные GitHub-аккаунты, добавьте ссылки на них; не угадывайте логины по никам.

Рекомендуемый блок:

```md
## Authors
- Bon_zeD
- Daswi

## AI assistance
Claude, ChatGPT and Notion AI were used during development for assistance
with code, analysis, tests and documentation. The project authors remain
responsible for release decisions and verification.

This does not imply endorsement by Anthropic, OpenAI or Notion.
```

Встроенный список **Contributors** формируется из истории Git. README/CREDITS — правильное место для явного раскрытия инструментов; создавать фальшивые аккаунты/коммиты от имени ИИ или указывать компании как издателя не нужно. Не добавляйте ИИ как соавторов людей через `Co-authored-by`, если это не реальные подтверждённые авторские Git-идентичности. Если Daswi вносит код через свой аккаунт/ветку и PR, вклад отразится в истории естественным образом.

Не публикуйте сырые чаты: в них могут быть персональные данные и секреты. Для прозрачности достаточно понятного описания способа использования ИИ; сохранение всех промптов не обязательно.

## 5. Проверьте сборку и Windows

В Actions есть workflow **Build Windows artifacts**. Он запускается вручную или при push тега `v*`, собирает EXE и отдаёт их как artifacts; сам публичный релиз не создаёт. Удалённый запуск этого workflow ещё нужно проверить в вашем репозитории.

Перед публичным выпуском выполните `docs/windows-media-session.md`: реальный Windows, оба движка воспроизведения, системные медиаконтролы/Windhawk, кнопки/перемотка, закрытие в трей, установка/удаление. Сборки без цифровой подписи: честно укажите это, не советуйте пользователям отключать антивирус или SmartScreen.

## 6. Создайте Release, а не коммит с EXE

GitHub блокирует обычные Git-файлы больше 100 MiB; бинарники Pulse размещайте во вложениях **Releases**, а не в исходниках.

1. Убедитесь, что `main` содержит **те самые исходники**, из которых собраны прикладываемые EXE.
2. Откройте **Releases → Draft a new release**.
3. Создайте тег **`v1.0.0`** на нужном коммите. Заголовок: **Pulse 1.0.0**.
4. Прикрепите актуальные `Pulse-Setup-1.0.0.exe`, `Pulse-1.0.0-portable.exe`, архив соответствующих исходников и `SHA256SUMS.txt`.
5. Заполните изменения и Known limitations. До проверки Windows/Windhawk используйте черновик или **This is a pre-release**, а не объявляйте полностью проверенную стабильную версию.
6. После проверки опубликуйте выпуск. Старые EXE не выдавайте за сборку из нового коммита; если выпуск уже публичный, код изменяется под новой patch-версией, например 1.0.1.

Пример заметок:

```md
## Pulse 1.0.0
Independent Windows music client with synchronized lyrics and GPU visualizers.

### Downloads
- Setup: normal installation.
- Portable: run without installing.

### Included
- English, Russian and Japanese interface.
- Native Windows media-session bridge.
- Lyrics, GPU visualizers and offline playback.

### Known limitations
- Unsigned Windows binaries.
- Service availability depends on region, account and content rights.
- [Describe the actual result of your Windows/Windhawk verification.]

### Credits
Authors: Bon_zeD, Daswi.
AI-assisted development: Claude, ChatGPT, Notion AI.
See NOTICE.md for third-party attribution and licenses.
```

Не публикуйте квадратную заглушку проверки как готовое утверждение. Для каждого EXE предоставляйте соответствующие исходники и сохраняйте условия GPL-3.0-or-later и лицензий компонентов.

## Официальная справка

- https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
