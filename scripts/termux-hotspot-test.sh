#!/data/data/com.termux/files/usr/bin/bash
# CampusBITE Termux Hotspot Diagnostic — run with hotspot ON and server running
echo "=== CampusBITE Hotspot Diagnostic ==="
echo "1. Hotspot IP via getprop:"
getprop | grep -i "192.168" | head -5 || echo "no getprop 192.168"
echo ""
echo "2. /proc/net/route:"
cat /proc/net/route 2>&1 | head -10
echo ""
echo "3. ifconfig (if net-tools installed):"
ifconfig 2>&1 | head -30 || echo "ifconfig not found → pkg install net-tools"
echo ""
echo "4. termux-wifi-connectioninfo:"
termux-wifi-connectioninfo 2>&1 | head -20 || echo "termux-wifi not installed"
echo ""
echo "5. cat /proc/net/arp (clients):"
cat /proc/net/arp 2>&1 | head -20
echo ""
echo "6. Test localhost (must be ok):"
curl -s http://localhost:3000/api/health | head -c 200; echo ""
curl -s http://127.0.0.1:3000/api/health | head -c 200; echo " (127.0.0.1)"
echo ""
echo "7. Test hotspot IP 192.168.43.1 (if fails, hotspot not sharing):"
curl -v --connect-timeout 3 http://192.168.43.1:3000/api/health 2>&1 | head -30
curl -s --connect-timeout 3 http://192.168.43.1:3000/api/health | head -c 200; echo "" || echo "192.168.43.1 failed — try: pkill node; Hotspot OFF→ON; node ... again"
ping -c 1 -W 2 192.168.43.1 2>&1 | head -5 || echo "ping failed"
echo ""
echo "8. Test alternatives:"
for ip in 192.168.12.1 192.168.49.1 192.168.208.1 192.168.137.1; do echo -n "$ip: "; curl -s --connect-timeout 2 http://$ip:3000/api/health | head -c 60 | tr -d '\n'; echo ""; done
echo ""
echo "9. Python http.server test (port 8000) — start in another Termux session: python3 -m http.server 8000, then curl here:"
curl -s --connect-timeout 3 http://192.168.43.1:8000 2>&1 | head -5 || echo "8000 failed — hotspot AP isolation ON?"
echo "=== Done ==="
