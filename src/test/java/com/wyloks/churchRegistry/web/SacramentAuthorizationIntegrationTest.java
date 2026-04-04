package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Baptism;
import com.wyloks.churchRegistry.entity.Confirmation;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.FirstHolyCommunion;
import com.wyloks.churchRegistry.entity.Marriage;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.BaptismRepository;
import com.wyloks.churchRegistry.repository.ConfirmationRepository;
import com.wyloks.churchRegistry.repository.DioceseRepository;
import com.wyloks.churchRegistry.repository.FirstHolyCommunionRepository;
import com.wyloks.churchRegistry.repository.MarriageRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SacramentAuthorizationIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    DioceseRepository dioceseRepository;

    @Autowired
    ParishRepository parishRepository;

    @Autowired
    AppUserRepository appUserRepository;

    @Autowired
    BaptismRepository baptismRepository;

    @Autowired
    FirstHolyCommunionRepository communionRepository;

    @Autowired
    ConfirmationRepository confirmationRepository;

    @Autowired
    MarriageRepository marriageRepository;

    private Parish parishA;
    private Parish parishB;
    private Baptism baptismA;
    private Baptism baptismB;
    private FirstHolyCommunion communionA;
    private FirstHolyCommunion communionB;
    private Confirmation confirmationA;
    private Confirmation confirmationB;
    private Marriage marriageA;
    private Marriage marriageB;
    private String writerUsername;
    private String writerPassword;
    private String viewerUsername;
    private String viewerPassword;

    @BeforeEach
    void setUp() {
        Diocese diocese = dioceseRepository.save(Diocese.builder()
                .dioceseName("Authz Diocese")
                .code("AUTHZ")
                .description("Authz test fixture")
                .build());

        parishA = parishRepository.save(Parish.builder()
                .parishName("Parish A")
                .diocese(diocese)
                .description("A")
                .build());
        parishB = parishRepository.save(Parish.builder()
                .parishName("Parish B")
                .diocese(diocese)
                .description("B")
                .build());

        baptismA = baptismRepository.save(baptismForParish(parishA, "Alice"));
        baptismB = baptismRepository.save(baptismForParish(parishB, "Bob"));

        communionA = communionRepository.save(FirstHolyCommunion.builder()
                .baptism(baptismA)
                .communionDate(LocalDate.of(2020, 6, 1))
                .officiatingPriest("Fr A")
                .parish("Parish A")
                .build());
        communionB = communionRepository.save(FirstHolyCommunion.builder()
                .baptism(baptismB)
                .communionDate(LocalDate.of(2020, 6, 1))
                .officiatingPriest("Fr B")
                .parish("Parish B")
                .build());

        confirmationA = confirmationRepository.save(Confirmation.builder()
                .baptism(baptismA)
                .firstHolyCommunion(communionA)
                .confirmationDate(LocalDate.of(2022, 5, 5))
                .officiatingBishop("Bp A")
                .parish("Parish A")
                .build());
        confirmationB = confirmationRepository.save(Confirmation.builder()
                .baptism(baptismB)
                .firstHolyCommunion(communionB)
                .confirmationDate(LocalDate.of(2022, 5, 5))
                .officiatingBishop("Bp B")
                .parish("Parish B")
                .build());

        marriageA = marriageRepository.save(Marriage.builder()
                .baptism(baptismA)
                .firstHolyCommunion(communionA)
                .confirmation(confirmationA)
                .partnersName("A Groom & A Bride")
                .marriageDate(LocalDate.of(2025, 1, 20))
                .officiatingPriest("Fr A")
                .parish("Parish A")
                .build());
        marriageB = marriageRepository.save(Marriage.builder()
                .baptism(baptismB)
                .firstHolyCommunion(communionB)
                .confirmation(confirmationB)
                .partnersName("B Groom & B Bride")
                .marriageDate(LocalDate.of(2025, 1, 20))
                .officiatingPriest("Fr B")
                .parish("Parish B")
                .build());

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        writerUsername = "writer_" + suffix;
        writerPassword = "secret123";
        viewerUsername = "viewer_" + suffix;
        viewerPassword = "secret123";

        AppUser writer = AppUser.builder()
                .username(writerUsername)
                .passwordHash(passwordEncoder.encode(writerPassword))
                .displayName("Parish Writer")
                .role("PARISH_PRIEST")
                .parish(parishA)
                .build();
        writer.getParishAccesses().add(parishA);
        appUserRepository.save(writer);

        appUserRepository.save(AppUser.builder()
                .username(viewerUsername)
                .passwordHash(passwordEncoder.encode(viewerPassword))
                .displayName("Parish Viewer")
                .role("PARISH_VIEWER")
                .parish(parishA)
                .build());
    }

    @Test
    void userWithTwoParishes_canCrudInBothParishes() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String multiParishUsername = "multi_" + suffix;
        String multiParishPassword = "secret123";

        AppUser multiParishUser = AppUser.builder()
                .username(multiParishUsername)
                .passwordHash(passwordEncoder.encode(multiParishPassword))
                .displayName("Multi Parish Priest")
                .role("PARISH_PRIEST")
                .parish(parishA)
                .build();
        multiParishUser.getParishAccesses().add(parishA);
        multiParishUser.getParishAccesses().add(parishB);
        appUserRepository.save(multiParishUser);

        String token = login(multiParishUsername, multiParishPassword);

        // Read parish A
        mvc.perform(get("/api/parishes/" + parishA.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/baptisms/" + baptismA.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        // Read parish B
        mvc.perform(get("/api/parishes/" + parishB.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/baptisms/" + baptismB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());

        // Create baptism in parish A
        Map<String, Object> baptismReqA = Map.ofEntries(
                Map.entry("baptismName", "New Child A"),
                Map.entry("surname", "Family"),
                Map.entry("gender", "F"),
                Map.entry("dateOfBirth", "2018-04-10"),
                Map.entry("fathersName", "Father"),
                Map.entry("mothersName", "Mother"),
                Map.entry("sponsorNames", "Sponsor"),
                Map.entry("parishId", parishA.getId()),
                Map.entry("placeOfBirth", "Lagos"),
                Map.entry("placeOfBaptism", "Parish A"),
                Map.entry("dateOfBaptism", "2018-05-15")
        );
        mvc.perform(post("/api/parishes/" + parishA.getId() + "/baptisms")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(baptismReqA)))
                .andExpect(status().isCreated());

        // Create baptism in parish B
        Map<String, Object> baptismReqB = Map.ofEntries(
                Map.entry("baptismName", "New Child B"),
                Map.entry("surname", "Family"),
                Map.entry("gender", "M"),
                Map.entry("dateOfBirth", "2019-05-15"),
                Map.entry("fathersName", "Father B"),
                Map.entry("mothersName", "Mother B"),
                Map.entry("sponsorNames", "Sponsor B"),
                Map.entry("parishId", parishB.getId()),
                Map.entry("placeOfBirth", "Abuja"),
                Map.entry("placeOfBaptism", "Parish B"),
                Map.entry("dateOfBaptism", "2019-06-20")
        );
        mvc.perform(post("/api/parishes/" + parishB.getId() + "/baptisms")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(baptismReqB)))
                .andExpect(status().isCreated());

        // PATCH baptism in parish A
        mvc.perform(patch("/api/baptisms/" + baptismA.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Test note A"))))
                .andExpect(status().isOk());

        // PATCH baptism in parish B
        mvc.perform(patch("/api/baptisms/" + baptismB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Test note B"))))
                .andExpect(status().isOk());

        // PATCH communion in parish B
        mvc.perform(patch("/api/communions/" + communionB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Communion note"))))
                .andExpect(status().isOk());

        // PATCH confirmation in parish B
        mvc.perform(patch("/api/confirmations/" + confirmationB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Confirmation note"))))
                .andExpect(status().isOk());

        // PATCH marriage in parish B
        mvc.perform(patch("/api/marriages/" + marriageB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Marriage note"))))
                .andExpect(status().isOk());
    }

    @Test
    void userWithZeroParishes_parishScopedReads_return403() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String noParishUsername = "noparish_" + suffix;
        String noParishPassword = "secret123";

        AppUser noParishUser = AppUser.builder()
                .username(noParishUsername)
                .passwordHash(passwordEncoder.encode(noParishPassword))
                .displayName("No Parish User")
                .role("PARISH_PRIEST")
                .parish(null)
                .build();
        appUserRepository.save(noParishUser);

        String token = login(noParishUsername, noParishPassword);

        mvc.perform(get("/api/parishes/" + parishA.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/baptisms/" + baptismA.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/parishes/" + parishA.getId() + "/baptisms")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBaptismRequest())))
                .andExpect(status().isForbidden());
    }

    @Test
    void parishWriter_crossParishPatch_returns403() throws Exception {
        String token = login(writerUsername, writerPassword);

        mvc.perform(patch("/api/baptisms/" + baptismB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Unauthorized note"))))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/communions/" + communionB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Unauthorized note"))))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/confirmations/" + confirmationB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Unauthorized note"))))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/marriages/" + marriageB.getId())
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("note", "Unauthorized note"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void parishWriter_crossParishEndpoints_return403() throws Exception {
        String token = login(writerUsername, writerPassword);

        mvc.perform(get("/api/parishes/" + parishB.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/baptisms/" + baptismB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/parishes/" + parishB.getId() + "/communions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/communions/" + communionB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/baptisms/" + baptismB.getId() + "/communions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/parishes/" + parishB.getId() + "/confirmations")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/confirmations/" + confirmationB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/parishes/" + parishB.getId() + "/marriages")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/marriages/" + marriageB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/parishes/" + parishB.getId() + "/baptisms")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBaptismRequest())))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/communions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCommunionRequest(baptismB.getId()))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/confirmations")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validConfirmationRequest(communionB.getId()))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/marriages")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validMarriageRequest(confirmationB.getId()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void parishWriter_sameParishReads_return200() throws Exception {
        String token = login(writerUsername, writerPassword);

        mvc.perform(get("/api/parishes/" + parishA.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/baptisms/" + baptismA.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/parishes/" + parishA.getId() + "/communions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/communions/" + communionA.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/baptisms/" + baptismA.getId() + "/communions")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/parishes/" + parishA.getId() + "/confirmations")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/confirmations/" + confirmationA.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/parishes/" + parishA.getId() + "/marriages")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/marriages/" + marriageA.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    @Test
    void parishViewer_postSacramentEndpoints_return403() throws Exception {
        String token = login(viewerUsername, viewerPassword);

        mvc.perform(post("/api/parishes/" + parishA.getId() + "/baptisms")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBaptismRequest())))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/communions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCommunionRequest(baptismA.getId()))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/confirmations")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validConfirmationRequest(communionA.getId()))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/marriages")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validMarriageRequest(confirmationA.getId()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void superAdmin_canReadAcrossParishes() throws Exception {
        String token = login("superadmin", "password");

        mvc.perform(get("/api/parishes/" + parishB.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/marriages/" + marriageB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    @Test
    void admin_cannotReadSacramentsOutsideAssignedParishes() throws Exception {
        AppUser admin = appUserRepository.findByUsername("admin").orElseThrow();
        admin.setParish(parishA);
        admin.getParishAccesses().clear();
        admin.getParishAccesses().add(parishA);
        appUserRepository.save(admin);

        String token = login("admin", "password");

        mvc.perform(get("/api/parishes/" + parishB.getId() + "/baptisms")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/marriages/" + marriageB.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
    }

    private Baptism baptismForParish(Parish parish, String namePrefix) {
        return Baptism.builder()
                .baptismName(namePrefix)
                .surname("Test")
                .gender("M")
                .dateOfBirth(LocalDate.of(2012, 1, 1))
                .fathersName("Father " + namePrefix)
                .mothersName("Mother " + namePrefix)
                .sponsorNames("Sponsor " + namePrefix)
                .parish(parish)
                .address("Addr " + namePrefix)
                .parishAddress("Parish Addr " + namePrefix)
                .parentAddress("Parent Addr " + namePrefix)
                .build();
    }

    private Map<String, Object> validBaptismRequest() {
        return Map.ofEntries(
                Map.entry("baptismName", "New Child"),
                Map.entry("surname", "Family"),
                Map.entry("gender", "F"),
                Map.entry("dateOfBirth", "2018-04-10"),
                Map.entry("fathersName", "Father"),
                Map.entry("mothersName", "Mother"),
                Map.entry("sponsorNames", "Sponsor"),
                Map.entry("parishId", parishA.getId()),
                Map.entry("placeOfBirth", "Lagos"),
                Map.entry("placeOfBaptism", "St Mary Church"),
                Map.entry("dateOfBaptism", "2018-05-15")
        );
    }

    private Map<String, Object> validCommunionRequest(Long baptismId) {
        return Map.of(
                "baptismId", baptismId,
                "communionDate", "2024-05-01",
                "officiatingPriest", "Fr Test",
                "parish", "Parish A"
        );
    }

    private Map<String, Object> validConfirmationRequest(Long communionId) {
        return Map.of(
                "communionId", communionId,
                "confirmationDate", "2024-06-01",
                "officiatingBishop", "Bp Test",
                "parish", "Parish A"
        );
    }

    private Map<String, Object> validMarriageRequest(Long confirmationId) {
        return Map.of(
                "confirmationId", confirmationId,
                "partnersName", "Partner A & Partner B",
                "marriageDate", "2025-01-01",
                "officiatingPriest", "Fr Test",
                "parish", "Parish A"
        );
    }

    private String login(String username, String password) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("username", username, "password", password));
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
