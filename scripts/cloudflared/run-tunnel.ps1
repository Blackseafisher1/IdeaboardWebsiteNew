# Run cloudflared tunnel using config
$ConfigPath = "$env:USERPROFILE\.cloudflared\config.yml"
cloudflared tunnel run --config $ConfigPath ideaboard-tunnel
