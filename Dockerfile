FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

# CMD only: Fly [processes] replaces CMD. An ENTRYPOINT + [processes] concatenates and can run
# `java ... app.jar java ... app.jar` (see Fly machine logs).
# 8080 matches fly.api*.toml internal_port; PORT env is still set for Spring if needed.
CMD ["java", "-Dserver.port=8080", "-Dserver.address=0.0.0.0", "-jar", "/app/app.jar"]
