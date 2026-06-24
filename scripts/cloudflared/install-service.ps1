# Install cloudflared as a Windows service (persistent)
$ConfigPath = "$env:USERPROFILE\.cloudflared\config.yml"
cloudflared service install --config $ConfigPath
