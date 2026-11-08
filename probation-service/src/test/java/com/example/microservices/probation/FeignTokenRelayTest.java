package com.example.microservices.probation;

import java.util.List;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import com.example.microservices.probation.security.*;
import feign.RequestTemplate;

class FeignTokenRelayTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void onlyVerifiedCallerCredentialsAreRelayed() {
        var template=new RequestTemplate(); var relay=new FeignTokenRelay();
        relay.apply(template); assertFalse(template.headers().containsKey("Authorization"));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            new CurrentUser(10L,"hr",null,"HR"),"verified-caller-token",List.of(new SimpleGrantedAuthority("ROLE_HR"))));
        relay.apply(template); assertEquals(List.of("Bearer verified-caller-token"),template.headers().get("Authorization").stream().toList());
    }
}
