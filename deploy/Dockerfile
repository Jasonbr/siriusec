FROM golang:1.20 AS builder

WORKDIR /src

RUN echo "cache-bust-20260602-1340"

COPY . .

RUN CGO_ENABLED=1 go build \
    -mod=vendor \
    -tags "webassets_embed" \
    -ldflags '-w -s' \
    -o /bin/siriusec \
    ./tool/siriusec

RUN CGO_ENABLED=1 go build \
    -mod=vendor \
    -ldflags '-w -s' \
    -o /bin/sctl \
    ./tool/sctl

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN echo "stage1-cache-bust-20260602-1341"

COPY --from=builder /bin/siriusec /usr/local/bin/siriusec
COPY --from=builder /bin/sctl /usr/local/bin/sctl

RUN mkdir -p /var/lib/siriusec /etc/siriusec && \
    groupadd -r siriusec && \
    useradd -r -g siriusec -d /var/lib/siriusec -s /sbin/nologin siriusec && \
    chown -R siriusec:siriusec /var/lib/siriusec /etc/siriusec

EXPOSE 3022 3023 3024 3025 3080

VOLUME ["/var/lib/siriusec", "/etc/siriusec"]

USER siriusec

STOPSIGNAL SIGQUIT

ENTRYPOINT ["dumb-init", "siriusec", "start"]
