FROM rust:latest

RUN cargo install mdbook
RUN cargo install --git https://github.com/sinotca529/mdbook-sinotca-flavored

CMD ["mdbook", "build"]
