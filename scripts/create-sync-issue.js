const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run() {
    const issueTitle = '[Upstream Sync Alert] Новые изменения в оригинальном macOS Compositor или расхождение паритета';
    
    // Check if issue already exists
    let existingIssue = '';
    try {
        existingIssue = execSync(`gh issue list --state open --search "${issueTitle}" --json number -q ".[0].number"`, { encoding: 'utf8' }).trim();
    } catch {
        existingIssue = '';
    }

    // Run parity audit
    let parityReport = '';
    try {
        parityReport = execSync('node scripts/parity-audit.js', { encoding: 'utf8' });
    } catch (e) {
        parityReport = e.stdout || e.message;
    }

    const newCommits = process.env.NEW_COMMITS || 'Нет новых коммитов в ветке upstream';
    const swiftChanges = process.env.SWIFT_CHANGES || 'Нет прямых изменений Swift-файлов в PR';

    const bodyContent = [
        '## ⚠️ Обнаружены новые изменения в Upstream macOS или расхождение паритета',
        '',
        '### 1. Статус паритета тестов',
        '```',
        parityReport.trim(),
        '```',
        '',
        '### 2. Новые коммиты автора в Compositor (macOS):',
        '```text',
        newCommits.trim(),
        '```',
        '',
        '### 3. Изменённые Swift-файлы:',
        '```text',
        swiftChanges.trim(),
        '```',
        '',
        '---',
        '*Автоматически создано воркфлоу **Upstream Sync & Parity Watcher**.*'
    ].join('\n');

    const tempFile = path.join(process.cwd(), 'issue_body_temp.md');
    fs.writeFileSync(tempFile, bodyContent, 'utf8');

    try {
        if (existingIssue) {
            console.log(`Обновление существующего Issue #${existingIssue}...`);
            execSync(`gh issue comment "${existingIssue}" --body-file "${tempFile}"`, { stdio: 'inherit' });
        } else {
            console.log('Создание нового Issue...');
            execSync(`gh issue create --title "${issueTitle}" --body-file "${tempFile}" --label "enhancement"`, { stdio: 'inherit' });
        }
    } catch (err) {
        console.error('Ошибка при работе с GitHub Issue:', err.message);
    } finally {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

run();
