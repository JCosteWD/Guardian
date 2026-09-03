package com.guardian.vpn;

import android.net.VpnService;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.*;
import java.net.*;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.*;

/**
 * GUARDIAN – VPN Local (DNS Filtering)
 * ======================================
 * Crée un VPN local qui intercepte TOUTES les requêtes DNS de l'appareil.
 * Les domaines bloqués reçoivent une réponse NXDOMAIN (site inexistant).
 * 
 * Stratégie:
 * - Crée une interface réseau TUN virtuelle (10.0.0.1/24)
 * - Redirige tout le trafic DNS (port 53) vers notre handler
 * - Les domaines autorisés sont transférés au vrai DNS (1.1.1.1)
 * - Les domaines bloqués reçoivent 0.0.0.0 (NXDOMAIN)
 * - Always-on VPN via DPC empêche sa désactivation
 *
 * Déclaration dans AndroidManifest.xml:
 * <service android:name=".vpn.GuardianVPNService"
 *          android:permission="android.permission.BIND_VPN_SERVICE">
 *   <intent-filter><action android:name="android.net.VpnService" /></intent-filter>
 * </service>
 */
public class GuardianVPNService extends VpnService {
    private static final String TAG = "GuardianVPN";
    private static final String VPN_ADDRESS = "10.0.0.1";
    private static final String DNS_SERVER = "1.1.1.1";
    private static final int DNS_PORT = 53;

    private static Set<String> blockedDomains = new HashSet<>();
    private static Set<String> blockedCategories = new HashSet<>();

    private ParcelFileDescriptor vpnInterface;
    private Thread vpnThread;
    private volatile boolean running = false;

    // Blocklist intégrée pour les catégories sensibles (domaines hardcodés)
    private static final Map<String, List<String>> CATEGORY_BLOCKS = new HashMap<String, List<String>>() {{
        put("adult", Arrays.asList(
            "pornhub.com", "xvideos.com", "xnxx.com", "redtube.com", "youjizz.com"
        ));
        put("gambling", Arrays.asList(
            "bet365.com", "pokerstars.com", "winamax.fr", "unibet.fr", "betclic.fr"
        ));
        put("violence", Arrays.asList(
            "bestgore.com", "liveleak.com", "goregrish.com"
        ));
        put("drugs", Arrays.asList(
            "erowid.org", "silk-road.com"
        ));
    }};

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            stopVPN();
            return START_NOT_STICKY;
        }

        // Récupère la blocklist depuis l'intent
        if (intent != null) {
            String[] domains = intent.getStringArrayExtra("blocked_domains");
            String[] categories = intent.getStringArrayExtra("blocked_categories");
            if (domains != null) blockedDomains = new HashSet<>(Arrays.asList(domains));
            if (categories != null) blockedCategories = new HashSet<>(Arrays.asList(categories));
        }

        startVPN();
        return START_STICKY; // Redémarre automatiquement si le système le tue
    }

    private void startVPN() {
        try {
            Builder builder = new Builder()
                .setSession("Guardian Protection")
                .addAddress(VPN_ADDRESS, 24)
                .addDnsServer(VPN_ADDRESS)   // Redirige DNS vers nous-mêmes
                .addRoute("0.0.0.0", 0)      // Capture tout le trafic IPv4
                .setMtu(1500)
                .setBlocking(true);

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface");
                return;
            }

            running = true;
            vpnThread = new Thread(this::runVPNLoop, "GuardianVPN-Thread");
            vpnThread.start();

            Log.i(TAG, "Guardian VPN started - filtering DNS traffic");
        } catch (Exception e) {
            Log.e(TAG, "VPN start failed: " + e.getMessage());
        }
    }

    private void runVPNLoop() {
        FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
        FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
        ByteBuffer buffer = ByteBuffer.allocate(32767);

        // DNS proxy sur port 53
        ExecutorService dnsExecutor = Executors.newFixedThreadPool(4);

        while (running) {
            try {
                buffer.clear();
                int length = in.read(buffer.array());
                if (length <= 0) continue;

                buffer.limit(length);

                // Parse le paquet IP
                IpPacket packet = IpPacket.parse(buffer.array(), length);
                if (packet == null) continue;

                // Intercepte les requêtes DNS (UDP port 53)
                if (packet.protocol == 17 && packet.destPort == DNS_PORT) {
                    dnsExecutor.submit(() -> {
                        try {
                            handleDNSQuery(packet, out);
                        } catch (Exception e) {
                            Log.e(TAG, "DNS handler error: " + e.getMessage());
                        }
                    });
                } else {
                    // Transfère le reste du trafic normalement
                    out.write(buffer.array(), 0, length);
                }
            } catch (Exception e) {
                if (running) Log.e(TAG, "VPN loop error: " + e.getMessage());
            }
        }

        dnsExecutor.shutdown();
    }

    private void handleDNSQuery(IpPacket packet, FileOutputStream out) throws IOException {
        // Parse la requête DNS
        String requestedDomain = parseDNSQuery(packet.payload);
        if (requestedDomain == null) return;

        Log.d(TAG, "DNS query: " + requestedDomain);

        // Vérifie si le domaine est bloqué
        if (isDomainBlocked(requestedDomain)) {
            Log.i(TAG, "BLOCKED: " + requestedDomain);
            broadcastBlockedDomain(requestedDomain);

            // Renvoie NXDOMAIN (domaine inexistant)
            byte[] nxdomainResponse = buildNXDomainResponse(packet.payload);
            byte[] responsePacket = buildIPPacket(packet, nxdomainResponse);
            out.write(responsePacket);
        } else {
            // Transfère au vrai DNS
            byte[] realResponse = forwardDNSQuery(packet.payload, DNS_SERVER);
            if (realResponse != null) {
                byte[] responsePacket = buildIPPacket(packet, realResponse);
                out.write(responsePacket);
            }
        }
    }

    private boolean isDomainBlocked(String domain) {
        if (domain == null) return false;
        String d = domain.toLowerCase().trim();

        // Vérifie les domaines explicitement bloqués
        if (blockedDomains.contains(d)) return true;

        // Vérifie les sous-domaines (ex: www.pornhub.com → pornhub.com)
        for (String blocked : blockedDomains) {
            if (d.endsWith("." + blocked) || d.equals(blocked)) return true;
        }

        // Vérifie les catégories
        for (String category : blockedCategories) {
            List<String> categoryDomains = CATEGORY_BLOCKS.get(category);
            if (categoryDomains != null) {
                for (String catDomain : categoryDomains) {
                    if (d.endsWith("." + catDomain) || d.equals(catDomain)) return true;
                }
            }
        }

        return false;
    }

    private void broadcastBlockedDomain(String domain) {
        Intent intent = new Intent("com.guardian.DOMAIN_BLOCKED");
        intent.putExtra("domain", domain);
        sendBroadcast(intent);
    }

    private void stopVPN() {
        running = false;
        if (vpnThread != null) vpnThread.interrupt();
        try {
            if (vpnInterface != null) vpnInterface.close();
        } catch (IOException e) {
            Log.e(TAG, "Error closing VPN interface: " + e.getMessage());
        }
        stopSelf();
        Log.i(TAG, "Guardian VPN stopped");
    }

    @Override
    public void onDestroy() {
        stopVPN();
        super.onDestroy();
    }

    // ── STATIC API (depuis React Native) ─────────────────────────────────────
    public static void updateBlocklist(String[] domains, String[] categories) {
        if (domains != null) blockedDomains = new HashSet<>(Arrays.asList(domains));
        if (categories != null) blockedCategories = new HashSet<>(Arrays.asList(categories));
        Log.i(TAG, "Blocklist updated: " + blockedDomains.size() + " domains, " + blockedCategories.size() + " categories");
    }

    // ── DNS HELPERS (simplifiés) ──────────────────────────────────────────────
    private String parseDNSQuery(byte[] dnsPayload) {
        try {
            if (dnsPayload == null || dnsPayload.length < 12) return null;
            StringBuilder domain = new StringBuilder();
            int pos = 12; // Skip DNS header
            while (pos < dnsPayload.length && dnsPayload[pos] != 0) {
                int labelLen = dnsPayload[pos++] & 0xFF;
                for (int i = 0; i < labelLen && pos < dnsPayload.length; i++) {
                    domain.append((char) dnsPayload[pos++]);
                }
                if (dnsPayload[pos] != 0) domain.append('.');
            }
            return domain.toString();
        } catch (Exception e) { return null; }
    }

    private byte[] buildNXDomainResponse(byte[] query) {
        if (query == null || query.length < 12) return new byte[12];
        byte[] response = Arrays.copyOf(query, query.length);
        response[2] = (byte) 0x81; // Response, recursion desired
        response[3] = (byte) 0x83; // NXDOMAIN rcode
        response[6] = 0; response[7] = 0; // Answer count = 0
        return response;
    }

    private byte[] forwardDNSQuery(byte[] query, String dnsServer) {
        try {
            DatagramSocket socket = new DatagramSocket();
            socket.setSoTimeout(3000);
            InetAddress addr = InetAddress.getByName(dnsServer);
            DatagramPacket sendPacket = new DatagramPacket(query, query.length, addr, 53);
            socket.send(sendPacket);
            byte[] responseBuffer = new byte[1024];
            DatagramPacket receivePacket = new DatagramPacket(responseBuffer, responseBuffer.length);
            socket.receive(receivePacket);
            socket.close();
            return Arrays.copyOf(responseBuffer, receivePacket.getLength());
        } catch (Exception e) { return null; }
    }

    private byte[] buildIPPacket(IpPacket original, byte[] payload) {
        // Construction simplifiée d'un paquet IP UDP de réponse
        return payload; // Simplifié – implémentation complète dans le code natif réel
    }

    // Classe helper pour parser les paquets IP
    static class IpPacket {
        int protocol;
        int srcPort, destPort;
        byte[] payload;

        static IpPacket parse(byte[] data, int length) {
            try {
                if (length < 20) return null;
                IpPacket p = new IpPacket();
                p.protocol = data[9] & 0xFF;
                int ipHeaderLen = (data[0] & 0x0F) * 4;
                if (p.protocol == 17 && length > ipHeaderLen + 8) { // UDP
                    p.srcPort = ((data[ipHeaderLen] & 0xFF) << 8) | (data[ipHeaderLen+1] & 0xFF);
                    p.destPort = ((data[ipHeaderLen+2] & 0xFF) << 8) | (data[ipHeaderLen+3] & 0xFF);
                    int udpLen = ((data[ipHeaderLen+4] & 0xFF) << 8) | (data[ipHeaderLen+5] & 0xFF);
                    p.payload = Arrays.copyOfRange(data, ipHeaderLen + 8, ipHeaderLen + udpLen);
                }
                return p;
            } catch (Exception e) { return null; }
        }
    }
}
