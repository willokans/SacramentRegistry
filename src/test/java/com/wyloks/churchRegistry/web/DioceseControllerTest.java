package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.dto.DioceseRequest;
import com.wyloks.churchRegistry.dto.DioceseResponse;
import com.wyloks.churchRegistry.service.DioceseService;
import com.wyloks.churchRegistry.service.ParishService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.wyloks.churchRegistry.config.TestSecurityConfig;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = DioceseController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class DioceseControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    DioceseService dioceseService;

    @MockBean
    ParishService parishService;

    @Test
    void getAllDioceses_returnsEmptyList_whenNoneExist() throws Exception {
        when(dioceseService.findAll()).thenReturn(List.of());

        mvc.perform(get("/api/dioceses"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getParishesByDiocese_returnsEmptyList_whenNoneExist() throws Exception {
        when(parishService.findByDioceseId(1L)).thenReturn(List.of());

        mvc.perform(get("/api/dioceses/1/parishes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void searchDioceses_returnsResultsScopedByCountry() throws Exception {
        DioceseResponse response = new DioceseResponse(1L, "Archdiocese of Abuja", "ABJ", null);
        when(dioceseService.searchByCountryAndQuery("NG", "abuja")).thenReturn(List.of(response));

        mvc.perform(get("/api/dioceses/search")
                        .param("countryCode", "NG")
                        .param("q", "abuja"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].dioceseName").value("Archdiocese of Abuja"));
    }

    @Test
    void searchDioceses_allowsCountryOnlyRequest_withoutQuery() throws Exception {
        DioceseResponse response = new DioceseResponse(2L, "Diocese of Lagos", "LAG", null);
        when(dioceseService.searchByCountryAndQuery("NG", null)).thenReturn(List.of(response));

        mvc.perform(get("/api/dioceses/search")
                        .param("countryCode", "NG"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].dioceseName").value("Diocese of Lagos"));

        verify(dioceseService).searchByCountryAndQuery(eq("NG"), isNull());
    }

    @Test
    void createDiocese_returns201AndBody_whenValid() throws Exception {
        DioceseRequest request = new DioceseRequest("Lagos Diocese", "LAG", "Archdiocese of Lagos");
        DioceseResponse response = new DioceseResponse(1L, "Lagos Diocese", "LAG", "Archdiocese of Lagos");

        when(dioceseService.create(any(DioceseRequest.class))).thenReturn(response);

        mvc.perform(post("/api/dioceses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.dioceseName").value("Lagos Diocese"))
                .andExpect(jsonPath("$.code").value("LAG"))
                .andExpect(jsonPath("$.description").value("Archdiocese of Lagos"));
    }

    @Test
    void getDioceseById_returns200AndBody_whenExists() throws Exception {
        DioceseResponse response = new DioceseResponse(1L, "Lagos Diocese", "LAG", null);
        when(dioceseService.findById(1L)).thenReturn(java.util.Optional.of(response));

        mvc.perform(get("/api/dioceses/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.dioceseName").value("Lagos Diocese"));
    }

    @Test
    void getDioceseById_returns404_whenNotExists() throws Exception {
        when(dioceseService.findById(999L)).thenReturn(java.util.Optional.empty());

        mvc.perform(get("/api/dioceses/999"))
                .andExpect(status().isNotFound());
    }
}
