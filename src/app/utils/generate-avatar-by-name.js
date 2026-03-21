// Função para gerar avatar com cor única baseada no nome
const generateAvatarByName = (name) => {
    if (!name || name.trim() === '') {
        return 'https://ui-avatars.com/api/?name=?&background=random&color=fff&size=256&bold=true&rounded=true'
    }

    const cleanName = name.trim()

    // Gera uma cor fixa baseada no nome (sempre a mesma cor pro mesmo nome)
    let hash = 0
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash)
    }

    // Converte hash pra cor hex (6 dígitos)
    let color = (hash & 0x00FFFFFF).toString(16).toUpperCase()
    color = '#' + '0'.repeat(6 - color.length) + color

    // Lista de cores bonitas (evita cores feias como amarelo claro)
    const niceColors = [
        '2563eb', '3b82f6', '8b5cf6', 'a855f7', 'd946ef',
        'ec4899', 'f43f5e', 'ef4444', 'f97316', 'f59e0b',
        'eab308', '84cc16', '22c55e', '10b981', '14b8a6',
        '06b6d4', '0ea5e9', '3b82f6', '6366f1', '8b5cf6'
    ]

    // Usa cor do hash ou fallback bonito
    const finalColor = niceColors[Math.abs(hash % niceColors.length)]

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=${finalColor}&color=fff&size=256&bold=true&rounded=true&format=png`
}

module.exports = { generateAvatarByName }