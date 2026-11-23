# Computer networks

A packet is a small unit of data sent across a network. It carries part of a message and enough addressing information for the network to forward it. A long message can travel as many packets, which the receiving application ultimately reads as a complete exchange.

## Local networks

A switch forwards Ethernet frames within a local network. It learns which devices are reachable through its ports by observing their hardware addresses. A wireless access point connects devices over radio and can bridge them to the wired local network.

## Routing

A router forwards packets between networks. It reads the destination IP address and uses a routing table to choose a next hop. The next hop may be the receiving device on a directly connected network or another router farther along the path.

<!-- page break -->

## DNS and addresses

DNS resolves names to records, such as an IP address for a host. An application can ask a resolver for an address before it connects. Resolvers can cache answers until the record's time to live expires. DNS lookup and packet forwarding are separate operations.

## TCP and UDP

TCP provides a reliable, ordered byte stream. It tracks delivery and can send missing data again. UDP sends datagrams without built-in delivery or ordering guarantees. An application that needs those properties over UDP has to implement them itself or use a protocol that provides them.

## Latency and bandwidth

Latency is how long an operation takes to complete. Bandwidth is how much data a connection can carry per unit of time. A connection can carry a lot of data while still taking a long time to deliver a request and its first response.
